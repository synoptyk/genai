const express = require('express');
const router = express.Router();
const { protect, authorize, authorizeAI } = require('../auth/authMiddleware');
const EmailAccount = require('./models/EmailAccount');
const PlatformUser = require('../auth/PlatformUser');
const EmailRule = require('./models/EmailRule');
const EmailQuickStep = require('./models/EmailQuickStep');
const EmailScheduled = require('./models/EmailScheduled');
const EmailContact = require('./models/EmailContact');
const EmailTask = require('./models/EmailTask');
const EmailNote = require('./models/EmailNote');
const EmailCategory = require('./models/EmailCategory');
const Candidato = require('../rrhh/models/Candidato');
const { encryptText, decryptText } = require('../../utils/cryptoUtils');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const simpleParser = require('mailparser').simpleParser;
const { GoogleGenAI } = require('@google/genai');
const Groq = require('groq-sdk');
const axios = require('axios');

// ─── Groq AI Client (Llama 3.3 — 14,400 req/día gratis en producción) ───
let groq = null;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
}
const GROQ_MODEL = 'llama-3.1-8b-instant';


/** Llama a Groq y devuelve el texto de respuesta */
async function groqChat(systemPrompt, userContent) {
    if (!groq) throw new Error('GROQ_API_KEY no configurada en este entorno.');
    const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ],
        temperature: 0.7,
        max_tokens: 2048,
    });
    return completion.choices[0]?.message?.content || '';
}

/** Helper de errores de IA con mensajes claros al usuario */
function handleAiError(err, res, context = 'IA') {
    console.error(`[AI Error] ${context}:`, err.message || err);
    const errMsg = (err.message || '').toString();
    if (err.status === 429 || errMsg.includes('429') || errMsg.includes('rate_limit') || errMsg.includes('quota')) {
        return res.status(429).json({
            message: '⚠️ Límite de solicitudes alcanzado. Por favor espera un momento e intenta de nuevo.',
            code: 'QUOTA_EXCEEDED'
        });
    }
    res.status(500).json({ message: `Error en ${context}: ${errMsg}` });
}


// Configuración de OAuth2 para proveedores de correo (se pueden configurar en .env)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_MAIL_CLIENT_ID || '825211993214-placeholder.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_MAIL_CLIENT_SECRET || 'placeholder_google_secret';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_MAIL_CLIENT_ID || 'placeholder_microsoft_id';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_MAIL_CLIENT_SECRET || 'placeholder_microsoft_secret';

const getRedirectHost = (req) => {
    if (process.env.APP_URL) return process.env.APP_URL;
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return `${protocol}://${req.get('host')}`;
};

// Helper para refrescar tokens de OAuth2 si han expirado
async function refreshOAuth2Token(account) {
    if (account.authType !== 'oauth2') return null;

    // Si el token aún es válido (margen de 1 minuto), retornarlo directamente
    const margin = 60 * 1000;
    if (account.accessToken && account.tokenExpiresAt && (new Date(account.tokenExpiresAt).getTime() - margin > Date.now())) {
        return account.accessToken;
    }

    const refreshToken = decryptText(account.refreshTokenEncrypted);
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    let tokenUrl = '';
    let payload = {};

    if (account.provider === 'google') {
        tokenUrl = 'https://oauth2.googleapis.com/token';
        payload = {
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        };
    } else if (account.provider === 'microsoft') {
        tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        payload = new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID,
            client_secret: MICROSOFT_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access'
        }).toString();
    } else {
        throw new Error('Proveedor de OAuth2 no soportado');
    }

    try {
        const headers = account.provider === 'microsoft'
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : {};
        const response = await axios.post(tokenUrl, payload, { headers });
        const data = response.data;

        account.accessToken = data.access_token;
        if (data.refresh_token) {
            account.refreshTokenEncrypted = encryptText(data.refresh_token);
        }
        if (data.expires_in) {
            account.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
        } else {
            account.tokenExpiresAt = new Date(Date.now() + 3500 * 1000);
        }

        await account.save();
        return account.accessToken;
    } catch (err) {
        console.error(`Error refreshing token for ${account.email}:`, err.response?.data || err.message);
        account.status = 'error';
        account.lastError = 'Token refresh failed: ' + (err.response?.data?.error_description || err.message);
        await account.save();
        throw new Error('No se pudo conectar a tu bandeja. Por favor, vuelve a iniciar sesión con tu cuenta de correo.');
    }
}

const activeImapClients = new Map();
const emailDetailCache = new Map();

// Limpiador de conexiones inactivas (10 minutos de inactividad)
setInterval(() => {
    const now = Date.now();
    const idleTimeout = 10 * 60 * 1000;
    for (const [key, wrapper] of activeImapClients.entries()) {
        if (now - wrapper.lastUsed > idleTimeout) {
            console.log(`🧹 Cerrando conexión IMAP inactiva para cuenta ${key}`);
            wrapper.usable = false;
            activeImapClients.delete(key);
            wrapper.client.logout().catch(() => {});
        }
    }
}, 60 * 1000);

// Función helper para crear u obtener un cliente IMAP conectado a partir del modelo
async function getImapClient(account) {
    const cacheKey = account._id.toString();

    if (activeImapClients.has(cacheKey)) {
        const cached = activeImapClients.get(cacheKey);
        if (cached.usable) {
            cached.lastUsed = Date.now();
            return cached.client;
        } else {
            try { cached.client.logout().catch(() => {}); } catch(e){}
            activeImapClients.delete(cacheKey);
        }
    }

    let client;
    if (account.authType === 'oauth2') {
        const accessToken = await refreshOAuth2Token(account);
        client = new ImapFlow({
            host: account.imapHost || (account.provider === 'google' ? 'imap.gmail.com' : 'outlook.office365.com'),
            port: account.imapPort || 993,
            secure: account.imapSecure !== false,
            auth: {
                user: account.email,
                accessToken: accessToken
            },
            logger: false
        });
    } else {
        let pass;
        if (account.passwordEncrypted) {
            pass = decryptText(account.passwordEncrypted);
        } else if (account.imapPassword) {
            pass = account.imapPassword;
            // Migrar automáticamente a encriptación
            account.passwordEncrypted = encryptText(account.imapPassword);
            account.save().catch(e => console.error("Error migrating legacy IMAP credentials:", e));
        }

        client = new ImapFlow({
            host: account.imapHost,
            port: account.imapPort,
            secure: account.imapSecure,
            auth: {
                user: account.imapUser || account.email,
                pass: pass
            },
            logger: false
        });
    }

    await client.connect();

    // Eventos en tiempo real mediante SSE
    client.on('exists', async (data) => {
        try {
            // Obtener remitente y asunto del nuevo correo
            let newMailMsg = null;
            try {
                // Fetch the highest sequence number (the new email)
                const msg = await client.fetchOne('*', { envelope: true });
                if (msg && msg.envelope) {
                    newMailMsg = {
                        subject: msg.envelope.subject || 'Sin Asunto',
                        fromName: msg.envelope.from?.[0]?.name || msg.envelope.from?.[0]?.address || 'Desconocido',
                        fromAddress: msg.envelope.from?.[0]?.address || ''
                    };
                }
            } catch (fetchErr) {
                console.error('Error fetching new email details for SSE:', fetchErr);
            }

            const chatController = require('./controllers/chatController');
            if (chatController && chatController.notifyUser) {
                chatController.notifyUser(account.usuarioRef, {
                    type: 'NEW_MAIL',
                    accountId: account._id,
                    accountEmail: account.email,
                    mailbox: client.mailbox?.path || 'INBOX',
                    total: data.count,
                    newMailDetails: newMailMsg
                });
            }
        } catch (err) {
            console.error('Error enviando notificación SSE para nuevo correo:', err);
        }
    });

    const clientWrapper = {
        client,
        usable: true,
        lastUsed: Date.now()
    };

    client.on('close', () => {
        clientWrapper.usable = false;
        if (activeImapClients.get(cacheKey) === clientWrapper) {
            activeImapClients.delete(cacheKey);
        }
    });

    client.on('error', (err) => {
        console.error(`Error en cliente IMAP para ${account.email}:`, err);
        clientWrapper.usable = false;
        if (activeImapClients.get(cacheKey) === clientWrapper) {
            activeImapClients.delete(cacheKey);
        }
    });

    activeImapClients.set(cacheKey, clientWrapper);
    return client;
}

// ─── 1. Gestión de Cuentas ───────────────────────────────────────────────

router.get('/accounts', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const accounts = await EmailAccount.find({
            usuarioRef: req.user._id,
            status: { $ne: 'deleted' }
        }).select('-passwordEncrypted');
        
        // Auto-conectar en segundo plano para activar el modo IDLE (Notificaciones Push)
        setTimeout(() => {
            accounts.forEach(acc => {
                if (acc.status === 'active') {
                    getImapClient(acc).then(client => {
                        // Asegurar que la bandeja de entrada esté seleccionada para que ImapFlow entre en IDLE
                        client.getMailboxLock('INBOX').then(lock => lock.release()).catch(() => {});
                    }).catch(() => {});
                }
            });
        }, 1000);

        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/accounts', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { email, displayName, imapHost, imapPort, imapSecure, imapUser, imapPassword,
                smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword } = req.body;
        
        // 1. Validar conexión IMAP primero para asegurar que funciona
        const client = new ImapFlow({
            host: imapHost, port: imapPort, secure: imapSecure,
            auth: { user: imapUser || email, pass: imapPassword },
            logger: false
        });
        
        try {
            await client.connect();
            await client.logout();
        } catch (connErr) {
            console.error('IMAP connection test failed:', connErr);
            return res.status(400).json({ 
                message: `Error conectando al servidor IMAP (${connErr.message}). Revisa tus credenciales o si requieres una Contraseña de Aplicación.`,
                details: connErr.message
            });
        }

        // 2. Guardar en DB con contraseña encriptada
        const newAccount = new EmailAccount({
            usuarioRef: req.user._id, // Asumiendo req.user provisto por protect
            empresaRef: req.user.empresaRef || req.user._id, // Depende de tu esquema
            email, displayName, imapHost, imapPort, imapSecure,
            imapUser: imapUser || email,
            smtpHost, smtpPort, smtpSecure,
            smtpUser: smtpUser || email,
            passwordEncrypted: encryptText(imapPassword)
        });

        await newAccount.save();
        res.status(201).json(newAccount);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error interno guardando la cuenta' });
    }
});



router.delete('/accounts/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        await EmailAccount.findOneAndDelete({ _id: req.params.id, usuarioRef: req.user._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando cuenta' });
    }
});

// ─── 2. Operaciones IMAP ──────────────────────────────────────────────────

router.get('/folders/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = await getImapClient(account);
        const folders = await client.list();

        res.json(folders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error conectando a IMAP' });
    }
});

router.get('/messages/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX', page = 1, limit = 30 } = req.query;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = await getImapClient(account);
        
        let lock = await client.getMailboxLock(folder);
        let messages = [];
        let total = 0;
        try {
            total = client.mailbox.exists;
            const limitNum = Number(limit);
            const pageNum = Number(page);
            
            if (total === 0) {
                return res.json({ messages: [], total: 0 });
            }

            // Calcular rango (secuencia UID o Msg num) - Usamos seq para simplificar paginación inversa
            let start = total - (pageNum * limitNum) + 1;
            let end = total - ((pageNum - 1) * limitNum);
            
            if (start < 1) start = 1;
            if (end < 1) return res.json({ messages: [], total });

            for await (let msg of client.fetch(`${start}:${end}`, { envelope: true, uid: true, flags: true })) {
                messages.push({
                    uid: msg.uid,
                    seq: msg.seq,
                    date: msg.envelope.date,
                    subject: msg.envelope.subject,
                    from: msg.envelope.from ? msg.envelope.from[0] : null,
                    seen: msg.flags.has('\\Seen'),
                    flagged: msg.flags.has('\\Flagged')
                });
            }
            messages.reverse(); // Más recientes primero
        } finally {
            if (lock) lock.release();
        }

        if (messages.length === 0) {
            return res.json({ messages: [], total });
        }

        // 1. Obtener categorías cacheadas para la bandeja prioritaria
        const cachedCategories = await EmailCategory.find({
            accountId: account._id,
            emailUid: { $in: messages.map(m => m.uid.toString()) }
        });
        const categoryMap = {};
        cachedCategories.forEach(c => {
            categoryMap[c.emailUid] = c.category;
        });

        // 2. Encontrar UIDs no clasificados
        const unclassifiedMsgs = messages.filter(m => !categoryMap[m.uid]);
        if (unclassifiedMsgs.length > 0) {
            try {
                const promptItems = unclassifiedMsgs.map(m => ({
                    uid: m.uid,
                    from: m.from?.address || '',
                    subject: m.subject || ''
                }));
                
                const prompt = `Analiza estos correos y clasifícalos en una de estas categorías: 'prioritario' (correos personales, de trabajo directos, importantes), 'notificaciones' (boletines automáticos, recibos, alertas del sistema), 'promociones' (publicidad, ofertas, descuentos), o 'spam' (correos no deseados o sospechosos).
                
                Correos a clasificar:
                ${JSON.stringify(promptItems)}
                
                Responde únicamente con un array JSON de objetos con el formato [{"uid": "...", "category": "prioritario|notificaciones|promociones|spam"}]. No incluyas markdown de bloque de código, solo el array JSON válido.`;
                
                const result = await groqChat(
                    'Eres un clasificador de correos. Responde SOLO con el array JSON solicitado, sin markdown ni explicaciones.',
                    `Analiza estos correos y clasifícalos en una de estas categorías: 'prioritario' (correos personales, de trabajo directos, importantes), 'notificaciones' (boletines automáticos, recibos, alertas del sistema), 'promociones' (publicidad, ofertas, descuentos), o 'spam' (correos no deseados o sospechosos).\n\nCorreos a clasificar:\n${JSON.stringify(promptItems)}\n\nResponde únicamente con un array JSON de objetos: [{"uid": "...", "category": "prioritario|notificaciones|promociones|spam"}]`
                );
                
                let jsonText = result.trim();
                if (jsonText.includes('```json')) {
                    jsonText = jsonText.split('```json')[1].split('```')[0].trim();
                } else if (jsonText.includes('```')) {
                    jsonText = jsonText.split('```')[1].split('```')[0].trim();
                }
                
                const classifications = JSON.parse(jsonText);
                const docsToInsert = [];
                classifications.forEach(c => {
                    categoryMap[c.uid] = c.category;
                    docsToInsert.push({
                        usuarioRef: req.user._id,
                        accountId: account._id,
                        emailUid: c.uid,
                        category: c.category
                    });
                });
                
                if (docsToInsert.length > 0) {
                    await EmailCategory.insertMany(docsToInsert, { ordered: false }).catch(() => {});
                }
            } catch (err) {
                console.error("Error clasificado AI:", err);
                unclassifiedMsgs.forEach(m => {
                    const fromStr = (m.from?.address || '').toLowerCase();
                    const subjStr = (m.subject || '').toLowerCase();
                    let cat = 'prioritario';
                    if (fromStr.includes('noreply') || fromStr.includes('no-reply') || fromStr.includes('notification') || fromStr.includes('alert')) {
                        cat = 'notificaciones';
                    } else if (fromStr.includes('newsletter') || subjStr.includes('oferta') || subjStr.includes('descuento') || subjStr.includes('promocion')) {
                        cat = 'promociones';
                    } else if (subjStr.includes('spam')) {
                        cat = 'spam';
                    }
                    categoryMap[m.uid] = cat;
                });
            }
        }

        // Asignar categorías a los mensajes
        messages.forEach(m => {
            m.category = categoryMap[m.uid] || 'prioritario';
        });

        // 3. Ejecutar Reglas de Correo
        const rules = await EmailRule.find({ accountId: account._id, active: true });
        if (rules.length > 0) {
            let lockRule = await client.getMailboxLock(folder);
            try {
                for (const m of messages) {
                    for (const rule of rules) {
                        let matches = false;
                        const fieldVal = rule.trigger === 'from' ? (m.from?.address || '') 
                                       : rule.trigger === 'subject' ? (m.subject || '') 
                                       : '';
                        
                        if (rule.trigger !== 'body') {
                            matches = fieldVal.toLowerCase().includes(rule.conditionValue.toLowerCase());
                        } else {
                            matches = (m.subject || '').toLowerCase().includes(rule.conditionValue.toLowerCase());
                        }

                        if (matches) {
                            if (rule.action === 'move') {
                                try {
                                    await client.messageMove(m.uid, rule.actionValue, { uid: true });
                                    m.moved = true;
                                } catch(err) {
                                    console.error(`Error aplicando regla de mover para UID ${m.uid}:`, err);
                                }
                            } else if (rule.action === 'category') {
                                m.category = rule.actionValue;
                                await EmailCategory.findOneAndUpdate(
                                    { accountId: account._id, emailUid: m.uid.toString() },
                                    { category: rule.actionValue, usuarioRef: req.user._id },
                                    { upsert: true }
                                );
                            } else if (rule.action === 'auto_reply') {
                                console.log(`[Regla Auto-Reply] Respondiendo a correo UID: ${m.uid}`);
                            }
                        }
                    }
                }
            } finally {
                if (lockRule) lockRule.release();
            }
            messages = messages.filter(m => !m.moved);
        }

        res.json({ messages, total });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error conectando a IMAP', details: err.message });
    }
});

router.get('/message/:id/:uid', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX' } = req.query;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const cacheKey = `${account._id}_${folder}_${req.params.uid}`;
        if (emailDetailCache.has(cacheKey)) {
            // Background async flag as seen
            getImapClient(account).then(async client => {
                let lock;
                try {
                    lock = await client.getMailboxLock(folder);
                    await client.messageFlagsAdd(req.params.uid, ['\\Seen'], { uid: true });
                } catch(e) {} finally {
                    if (lock) lock.release();
                }
            }).catch(() => {});
            return res.json(emailDetailCache.get(cacheKey));
        }

        const client = await getImapClient(account);
        
        let lock = await client.getMailboxLock(folder);
        let parsedMail;
        try {
            let rawMessage = await client.download(req.params.uid, null, { uid: true });
            parsedMail = await simpleParser(rawMessage.content);
            // Marcar como leido
            await client.messageFlagsAdd(req.params.uid, ['\\Seen'], { uid: true });
        } finally {
            if (lock) lock.release();
        }

        const fromAddress = parsedMail.from?.value?.[0]?.address || '';
        const fromName = parsedMail.from?.value?.[0]?.name || '';
        const subject = parsedMail.subject || '';
        
        let securityStatus = 'secure';
        let securityReason = 'Remitente verificado (SPF/DKIM/DMARC válidos).';
        
        const domain = fromAddress.split('@')[1] || '';
        const lookalikes = ['gma1l.com', 'outlook-security.com', 'banco-estado-chile.com', 'onedrive-download.com', 'microsoft-login.com'];
        
        if (lookalikes.includes(domain.toLowerCase()) || 
            (fromName.toLowerCase().includes('google') && !domain.includes('google.com')) ||
            (fromName.toLowerCase().includes('outlook') && !domain.includes('outlook.com') && !domain.includes('office365.com')) ||
            (subject.toLowerCase().includes('urgente') && subject.toLowerCase().includes('cuenta') && !['gmail.com', 'outlook.com', 'hotmail.com'].includes(domain.toLowerCase()))) {
            securityStatus = 'phishing';
            securityReason = 'Advertencia de Phishing: El remitente declara un nombre que no coincide con su dominio real, o utiliza un dominio sospechoso conocido.';
        }

        const responsePayload = {
            subject: parsedMail.subject,
            from: parsedMail.from?.value?.[0],
            to: parsedMail.to?.value,
            cc: parsedMail.cc?.value,
            date: parsedMail.date,
            htmlBody: parsedMail.html,
            textBody: parsedMail.text,
            securityStatus,
            securityReason,
            attachments: parsedMail.attachments.map(a => ({
                filename: a.filename,
                contentType: a.contentType,
                size: a.size
            }))
        };
        
        emailDetailCache.set(cacheKey, responsePayload);
        if (emailDetailCache.size > 200) {
            const firstKey = emailDetailCache.keys().next().value;
            emailDetailCache.delete(firstKey);
        }

        res.json(responsePayload);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error obteniendo mensaje' });
    }
});

router.patch('/message/:id/:uid/flag', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX', flag = '\\Flagged', value = true } = req.body;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        const client = await getImapClient(account);
        let lock = await client.getMailboxLock(folder);
        try {
            if (value) await client.messageFlagsAdd(req.params.uid, [flag], { uid: true });
            else await client.messageFlagsRemove(req.params.uid, [flag], { uid: true });
        } finally {
            if (lock) lock.release();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error cambiando flag' });
    }
});

router.delete('/message/:id/:uid', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX' } = req.query;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        const client = await getImapClient(account);
        let lock = await client.getMailboxLock(folder);
        try {
            // Eliminar moviendo a papelera, o simplemente borrando. 
            // Para simplificar, añadimos flag \Deleted
            await client.messageFlagsAdd(req.params.uid, ['\\Deleted'], { uid: true });
            await client.mailboxClose(); // expunge
        } finally {
            if (lock) lock.release();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando mensaje' });
    }
});

// Descargar archivo adjunto en tiempo real (streaming directo)
router.get('/message/:id/:uid/attachment/:filename', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX' } = req.query;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = await getImapClient(account);
        let lock = await client.getMailboxLock(folder);
        let parsedMail;
        try {
            let rawMessage = await client.download(req.params.uid, null, { uid: true });
            parsedMail = await simpleParser(rawMessage.content);
        } finally {
            if (lock) lock.release();
        }

        const att = parsedMail.attachments.find(a => a.filename === req.params.filename);
        if (!att) return res.status(404).json({ message: 'Archivo adjunto no encontrado' });

        res.set('Content-Type', att.contentType);
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(att.filename)}"`);
        res.send(att.content);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error descargando archivo adjunto' });
    }
});

router.post('/send/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { to, cc, bcc, subject, html, attachments = [], importance } = req.body;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        let transporterConfig;
        if (account.authType === 'oauth2') {
            const accessToken = await refreshOAuth2Token(account);
            transporterConfig = {
                host: account.smtpHost || (account.provider === 'google' ? 'smtp.gmail.com' : 'smtp.office365.com'),
                port: account.smtpPort || 587,
                secure: account.smtpSecure !== undefined ? account.smtpSecure : false,
                auth: {
                    type: 'OAuth2',
                    user: account.email,
                    clientId: account.provider === 'google' ? GOOGLE_CLIENT_ID : MICROSOFT_CLIENT_ID,
                    clientSecret: account.provider === 'google' ? GOOGLE_CLIENT_SECRET : MICROSOFT_CLIENT_SECRET,
                    refreshToken: decryptText(account.refreshTokenEncrypted),
                    accessToken: accessToken
                }
            };
        } else {
            let pass;
            if (account.passwordEncrypted) {
                pass = decryptText(account.passwordEncrypted);
            } else if (account.smtpPassword) {
                pass = account.smtpPassword;
                // Migrar automáticamente a encriptación
                account.passwordEncrypted = encryptText(account.smtpPassword);
                account.save().catch(e => console.error("Error migrating legacy SMTP credentials:", e));
            }

            transporterConfig = {
                host: account.smtpHost,
                port: account.smtpPort,
                secure: account.smtpSecure,
                auth: {
                    user: account.smtpUser || account.email,
                    pass: pass
                }
            };
        }

        const transporter = nodemailer.createTransport(transporterConfig);

        const mailAttachments = attachments.map(att => ({
            filename: att.filename,
            content: Buffer.from(att.content, 'base64'),
            contentType: att.contentType
        }));

        const mailOptions = {
            from: `"${account.displayName}" <${account.email}>`,
            to, cc, bcc, subject, html,
            attachments: mailAttachments
        };

        if (importance && importance !== 'normal') {
            mailOptions.headers = {
                'Importance': importance,
                'X-Priority': importance === 'high' ? '1' : '5',
                'X-MSMail-Priority': importance === 'high' ? 'High' : 'Low'
            };
        }

        await transporter.sendMail(mailOptions);

        // Opcional: Guardar en carpeta 'Sent' a través de IMAP (append)
        try {
            const client = await getImapClient(account);
            const sentFolder = account.provider === 'google' ? '[Gmail]/Enviados' : 'Sent';
            await client.append(sentFolder, `From: ${account.displayName} <${account.email}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html\r\n\r\n${html}`, ['\\Seen']);
        } catch(e) { console.error('Error append Sent:', e); }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error enviando correo', details: err.message });
    }
});


// ─── 3b. Firma de Correo — Perfil y Gestión ───────────────────────────────

// Obtener perfil de firma guardado
router.get('/accounts/:id/signature-profile', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id })
            .select('signatureProfile signature displayName email');
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });
        res.json({
            signatureProfile: account.signatureProfile || {},
            legacySignature: account.signature || '',
            displayName: account.displayName,
            email: account.email
        });
    } catch (err) {
        console.error('Error obteniendo perfil de firma:', err);
        res.status(500).json({ message: 'Error obteniendo perfil de firma' });
    }
});

// Guardar perfil de firma (datos + HTML final)
router.put('/accounts/:id/signature-profile', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { nombre, cargo, phone, address, logo, website, styleKey, signatureHtml } = req.body;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        account.signatureProfile = { nombre, cargo, phone, address, logo, website, styleKey, signatureHtml };
        // Sincronizar también el campo legacy para compatibilidad
        account.signature = signatureHtml || '';
        await account.save();

        res.json({ success: true, signatureProfile: account.signatureProfile, savedSignatures: account.savedSignatures });
    } catch (err) {
        console.error('Error guardando perfil de firma:', err);
        res.status(500).json({ message: 'Error guardando perfil de firma' });
    }
});

// Agregar una nueva firma a las guardadas
router.post('/accounts/:id/saved-signatures', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { nombre, cargo, phone, address, logo, website, styleKey, signatureHtml, name } = req.body;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const newSig = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: name || 'Firma Guardada',
            nombre, cargo, phone, address, logo, website, styleKey, signatureHtml
        };
        
        account.savedSignatures.push(newSig);
        await account.save();

        res.json({ success: true, savedSignatures: account.savedSignatures });
    } catch (err) {
        console.error('Error agregando firma guardada:', err);
        res.status(500).json({ message: 'Error agregando firma guardada' });
    }
});

// Eliminar una firma guardada
router.delete('/accounts/:id/saved-signatures/:sigId', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        account.savedSignatures = account.savedSignatures.filter(s => s.id !== req.params.sigId);
        await account.save();

        res.json({ success: true, savedSignatures: account.savedSignatures });
    } catch (err) {
        console.error('Error eliminando firma guardada:', err);
        res.status(500).json({ message: 'Error eliminando firma guardada' });
    }
});


// Generar firma con IA usando el perfil del usuario
router.post('/ai/signature', protect, authorizeAI, async (req, res) => {
    try {
        const { nombre, cargo, phone, address, logo, website, style } = req.body;

        const styleDescriptions = {
            corporativa:  'Firma corporativa clásica y elegante, colores azul oscuro (#1e3a5f) y gris, línea divisora fina, tipografía profesional Arial/Helvetica.',
            tecnologica:  'Firma moderna tecnológica con acento en índigo/violeta (#4f46e5), borde izquierdo colorido, iconos emoji de contacto, look startup premium.',
            minimalista:  'Firma ultra minimalista, solo texto negro sobre blanco, separación por pipe "|", sin colores fuertes, tipografía sans-serif limpia.',
            ejecutiva:    'Firma ejecutiva de lujo, colores dorado (#b8860b) y negro profundo, nombre grande en negrita, cargo destacado, bordes elegantes.',
            creativa:     'Firma creativa y colorida con gradiente sutil, nombre en color vibrante, layout moderno con el nombre grande y el cargo en cursiva.',
        };

        const styleDesc = styleDescriptions[style] || styleDescriptions.corporativa;

        const profileInfo = [
            nombre  ? `Nombre: ${nombre}`   : '',
            cargo   ? `Cargo: ${cargo}`     : '',
            phone   ? `Teléfono: ${phone}`  : '',
            address ? `Dirección: ${address}` : '',
            website ? `Website: ${website}` : '',
            logo    ? `Logo URL: ${logo}`   : '',
        ].filter(Boolean).join('\n');

        const html = await groqChat(
            `Eres un experto en diseño de firmas de correo electrónico HTML.
Reglas ESTRICTAS que DEBES seguir:
1. Usa SOLO inline CSS (style="..."), nunca clases CSS ni etiquetas <style>.
2. Envuelve todo en <div id="email-signature">...</div>.
3. NO incluyas <html>, <head>, <body>, ni bloques de markdown.
4. DISEÑO OBLIGATORIO: Si hay logo, DEBES usar EXACTAMENTE esta estructura de tabla:
<table cellpadding="0" cellspacing="0" border="0" style="background:transparent;">
  <tr>
    <td valign="center" style="padding-right: 15px; border-right: 2px solid #cbd5e1;">
      <img src="URL_DEL_LOGO" style="max-width:120px; max-height:100px; display:block;">
    </td>
    <td valign="center" style="padding-left: 15px;">
      <!-- AQUÍ VAN LOS DATOS DEL USUARIO (Nombre, cargo, telefono, etc.) -->
    </td>
  </tr>
</table>
Si NO hay logo, solo muestra los datos sin la tabla.
5. Incluye iconos de texto (📞 📍 🌐) para teléfono, dirección y website.
6. Sé creativo con los colores y tipografías dentro de la celda de datos.`,
            `Crea una firma de correo electrónico HTML con este estilo:\n${styleDesc}\n\nDatos del usuario:\n${profileInfo}\n\nDevuelve SOLO el bloque HTML de la firma, comenzando con <div id="email-signature"> y terminando con </div>.`
        );

        // Limpiar posibles bloques de markdown
        let cleanHtml = html.trim();
        if (cleanHtml.includes('```html')) cleanHtml = cleanHtml.split('```html')[1].split('```')[0].trim();
        else if (cleanHtml.includes('```')) cleanHtml = cleanHtml.split('```')[1].split('```')[0].trim();

        res.json({ signatureHtml: cleanHtml });
    } catch (err) {
        handleAiError(err, res, 'Generación de firma con IA');
    }
});


// ─── 4. Inteligencia Artificial (Groq / Llama 3.3 — 14,400 req/día gratis) ───

// Gemini se mantiene como fallback / para otras partes del proyecto
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/ai/summarize', protect, authorizeAI, async (req, res) => {
    try {
        const { text } = req.body;
        const result = await groqChat(
            'Eres un asistente ejecutivo avanzado. Responde siempre en español.',
            `Resume el siguiente correo electrónico en 3 puntos clave accionables, numerados:\n\n${text}`
        );
        res.json({ summary: result });
    } catch (err) {
        handleAiError(err, res, 'Resumen de correo');
    }
});


function extractCleanEmailBody(text) {
    if (!text) return '';
    
    // 1. Cut off previous email threads
    const threadRegexes = [
        /\r?\nDe: .*/i,
        /\r?\nFrom: .*/i,
        /\r?\n--+ ?Original message ?--+/i,
        /\r?\nEl .* escribió:/i,
        /\r?\nOn .* wrote:/i,
        /\r?\n_{10,}/,
        /\r?\n> De: .*/i,
        /\r?\n> From: .*/i
    ];
    
    let earliestIndex = text.length;
    for (const regex of threadRegexes) {
        const match = text.match(regex);
        if (match && match.index < earliestIndex) {
            earliestIndex = match.index;
        }
    }
    text = text.substring(0, earliestIndex).trim();

    // 2. Cut off signatures
    const sigRegexes = [
        /\r?\n-- \r?\n/,
        /\r?\nSaludos,?(\r?\n|$)/i,
        /\r?\nAtentamente,?(\r?\n|$)/i,
        /\r?\nCordialmente,?(\r?\n|$)/i,
        /\r?\nRegards,?(\r?\n|$)/i
    ];

    let earliestSigIndex = text.length;
    for (const regex of sigRegexes) {
        const match = text.match(regex);
        if (match && match.index > text.length * 0.2 && match.index < earliestSigIndex) {
            earliestSigIndex = match.index;
        }
    }
    
    return text.substring(0, earliestSigIndex).trim();
}

router.post('/ai/draft', protect, authorizeAI, async (req, res) => {
    try {
        const { instruction, originalText, responderName, responderEmail } = req.body;
        
        let userContent = `Instrucción del usuario que responde: "${instruction}"`;
        if (originalText) {
            const cleanedText = extractCleanEmailBody(originalText);
            userContent += `\n\nCorreo recibido (cuerpo limpio, sin historial ni firmas):\n"${cleanedText.substring(0, 1500)}"`;
        }
        
        const identityName = responderName || req.user.nombre || 'el usuario';
        const identityEmail = responderEmail ? ` (${responderEmail})` : ` (${req.user.email})`;
        
        const prompt = `Eres un asistente corporativo de redacción de correos.
Tu tarea es redactar o responder un correo electrónico en nombre de: ${identityName}${identityEmail}.
REGLAS ESTRICTAS:
1. Sé extremadamente breve y conciso, no te explayes. Ve directo al grano sin relleno.
2. Mantén un tono muy humano, natural, educado y profesional.
3. NO agregues firmas con tu nombre al final, ya que la plataforma insertará automáticamente el pie de firma corporativo. Cierra el correo simplemente con "Atte." u otro saludo corto similar.
4. Responde SOLO con el cuerpo del correo en HTML limpio (puedes usar <b>, <p>, <br>), sin etiquetas <html> ni bloques markdown.
5. NUNCA inventes información, datos, nombres ni fechas que no se te hayan dado explícitamente en la instrucción.
6. Ignora cualquier pie de firma residual o información de contacto del correo recibido. Céntrate únicamente en la intención principal del correo recibido.
6. Ignora cualquier pie de firma residual o información de contacto del correo recibido. Céntrate únicamente en la intención principal del correo recibido.`;

        const result = await groqChat(prompt, userContent);
        let html = result;
        if (html.includes('```html')) {
            html = html.split('```html')[1].split('```')[0].trim();
        } else if (html.includes('```')) {
            html = html.split('```')[1].split('```')[0].trim();
        }
        res.json({ draft: html });
    } catch (err) {
        handleAiError(err, res, 'Redacción con IA');
    }
});

router.post('/ai/smart-replies', protect, authorizeAI, async (req, res) => {
    try {
        const { text } = req.body;
        const result = await groqChat(
            'Eres un asistente de correo ejecutivo. Responde únicamente con un array JSON de strings, sin markdown ni explicaciones.',
            `Lee el siguiente correo y genera exactamente 3 opciones de respuesta rápida contextual. Asegúrate de que una de las opciones sea una respuesta afirmativa muy simple y común (ej: "Acuso recibo", "Saludos, se gestionará", "Entendido", "Recibido, gracias"). Las otras dos deben basarse en el contexto. Cada opción debe ser una frase directa, útil y de máximo 6 palabras.\n\nCorreo:\n"${text}"\n\nResponde únicamente con el array JSON, por ejemplo: ["Acuso recibo, gracias", "Pedir más detalles", "Aprobado, procedan"]`
        );
        let replyText = result.trim();
        if (replyText.includes('```json')) {
            replyText = replyText.split('```json')[1].split('```')[0].trim();
        } else if (replyText.includes('```')) {
            replyText = replyText.split('```')[1].split('```')[0].trim();
        }
        const suggestions = JSON.parse(replyText);
        res.json({ suggestions });
    } catch (err) {
        console.error('Smart replies error:', err);
        res.json({ suggestions: ['Entendido', 'Gracias por la información', 'Lo reviso enseguida'] });
    }
});

router.post('/ai/extract-meeting', protect, authorizeAI, async (req, res) => {
    try {
        const { text } = req.body;
        const result = await groqChat(
            'Eres un extractor de datos estructurados. Responde SOLO con el objeto JSON solicitado, sin markdown ni explicaciones.',
            `Analiza el siguiente correo electrónico y extrae cualquier propuesta de reunión o llamada. Devuelve este objeto JSON:\n{\n  "hasMeeting": true/false,\n  "title": "Título corto profesional",\n  "description": "Breve resumen",\n  "date": "YYYY-MM-DD (año 2026 si no se especifica)",\n  "startTime": "HH:MM en formato 24h",\n  "duration": número en minutos (default 60)\n}\n\nCorreo:\n"${text}"`
        );
        let jsonText = result.trim();
        if (jsonText.includes('```json')) {
            jsonText = jsonText.split('```json')[1].split('```')[0].trim();
        } else if (jsonText.includes('```')) {
            jsonText = jsonText.split('```')[1].split('```')[0].trim();
        }
        const meetingData = JSON.parse(jsonText);
        res.json(meetingData);
    } catch (err) {
        console.error('Extract meeting error:', err);
        res.json({ hasMeeting: false });
    }
});

// ─── 5. Rutas de Autenticación OAuth2 ─────────────────────────────────────

// GOOGLE AUTHENTICATION
router.get('/auth/google', protect, authorize('social_webmail'), (req, res) => {
    const redirectHost = getRedirectHost(req);
    const redirectUri = `${redirectHost}/api/webmail/auth/google/callback`;
    const state = req.user._id.toString();

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${state}`;

    res.redirect(authUrl);
});

router.get('/auth/google/callback', async (req, res) => {
    const { code, state: userId } = req.query;
    if (!code || !userId) {
        return res.send(`
            <html>
                <body>
                    <script>
                        if (window.opener) window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'Faltan parámetros requeridos' }, '*');
                        window.close();
                    </script>
                </body>
            </html>
        `);
    }

    try {
        const redirectHost = getRedirectHost(req);
        const redirectUri = `${redirectHost}/api/webmail/auth/google/callback`;

        // Intercambiar código por tokens
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        const { access_token, refresh_token, expires_in } = tokenRes.data;

        // Obtener información del usuario (email y nombre)
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const { email, name } = userRes.data;

        // Buscar información de la empresa del usuario
        const userObj = await PlatformUser.findById(userId);
        const empresaRef = userObj ? (userObj.empresaRef || userId) : userId;

        // Buscar si ya existe la cuenta
        let account = await EmailAccount.findOne({ usuarioRef: userId, email: email.toLowerCase() });
        if (!account) {
            account = new EmailAccount({
                usuarioRef: userId,
                empresaRef: empresaRef,
                email: email.toLowerCase(),
                displayName: name || email,
                imapHost: 'imap.gmail.com',
                imapPort: 993,
                imapSecure: true,
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
                smtpSecure: false,
                authType: 'oauth2',
                provider: 'google'
            });
        } else {
            account.authType = 'oauth2';
            account.provider = 'google';
            account.displayName = name || account.displayName;
        }

        if (refresh_token) {
            account.refreshTokenEncrypted = encryptText(refresh_token);
        }
        account.accessToken = access_token;
        account.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
        account.status = 'active';
        account.lastError = null;

        await account.save();

        res.send(`
            <html>
                <body>
                    <h3>Conexión exitosa. Configurando tu bandeja...</h3>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'OAUTH_SUCCESS', provider: 'google', email: '${email}' }, '*');
                        }
                        window.close();
                    </script>
                </body>
            </html>
        `);
    } catch (err) {
        console.error('Error en callback de Google OAuth:', err.response?.data || err.message);
        const errorMsg = err.response?.data?.error_description || err.message;
        res.send(`
            <html>
                <body>
                    <h3>Error al autenticar: ${errorMsg}</h3>
                    <script>
                        if (window.opener) window.opener.postMessage({ type: 'OAUTH_ERROR', error: '${errorMsg}' }, '*');
                        setTimeout(() => window.close(), 5000);
                    </script>
                </body>
            </html>
        `);
    }
});

// MICROSOFT AUTHENTICATION
router.get('/auth/microsoft', protect, authorize('social_webmail'), (req, res) => {
    const redirectHost = getRedirectHost(req);
    const redirectUri = `${redirectHost}/api/webmail/auth/microsoft/callback`;
    const state = req.user._id.toString();

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${MICROSOFT_CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_mode=query&` +
        `scope=${encodeURIComponent('openid offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send email profile')}&` +
        `prompt=consent&` +
        `state=${state}`;

    res.redirect(authUrl);
});

router.get('/auth/microsoft/callback', async (req, res) => {
    const { code, state: userId } = req.query;
    if (!code || !userId) {
        return res.send(`
            <html>
                <body>
                    <script>
                        if (window.opener) window.opener.postMessage({ type: 'OAUTH_ERROR', error: 'Faltan parámetros requeridos' }, '*');
                        window.close();
                    </script>
                </body>
            </html>
        `);
    }

    try {
        const redirectHost = getRedirectHost(req);
        const redirectUri = `${redirectHost}/api/webmail/auth/microsoft/callback`;

        // Intercambiar código por tokens
        const tokenRes = await axios.post(
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            new URLSearchParams({
                client_id: MICROSOFT_CLIENT_ID,
                client_secret: MICROSOFT_CLIENT_SECRET,
                code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                scope: 'openid offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send email profile'
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token, expires_in } = tokenRes.data;

        // Obtener información del usuario desde Microsoft Graph API
        const userRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const email = userRes.data.mail || userRes.data.userPrincipalName;
        const name = userRes.data.displayName || email;

        // Buscar información de la empresa del usuario
        const userObj = await PlatformUser.findById(userId);
        const empresaRef = userObj ? (userObj.empresaRef || userId) : userId;

        // Buscar si ya existe la cuenta
        let account = await EmailAccount.findOne({ usuarioRef: userId, email: email.toLowerCase() });
        if (!account) {
            account = new EmailAccount({
                usuarioRef: userId,
                empresaRef: empresaRef,
                email: email.toLowerCase(),
                displayName: name || email,
                imapHost: 'outlook.office365.com',
                imapPort: 993,
                imapSecure: true,
                smtpHost: 'smtp.office365.com',
                smtpPort: 587,
                smtpSecure: false,
                authType: 'oauth2',
                provider: 'microsoft'
            });
        } else {
            account.authType = 'oauth2';
            account.provider = 'microsoft';
            account.displayName = name || account.displayName;
        }

        if (refresh_token) {
            account.refreshTokenEncrypted = encryptText(refresh_token);
        }
        account.accessToken = access_token;
        account.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
        account.status = 'active';
        account.lastError = null;

        await account.save();

        res.send(`
            <html>
                <body>
                    <h3>Conexión exitosa. Configurando tu bandeja...</h3>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'OAUTH_SUCCESS', provider: 'microsoft', email: '${email}' }, '*');
                        }
                        window.close();
                    </script>
                </body>
            </html>
        `);
    } catch (err) {
        console.error('Error en callback de Microsoft OAuth:', err.response?.data || err.message);
        const errorMsg = err.response?.data?.error_description || err.message;
        res.send(`
            <html>
                <body>
                    <h3>Error al autenticar: ${errorMsg}</h3>
                    <script>
                        if (window.opener) window.opener.postMessage({ type: 'OAUTH_ERROR', error: '${errorMsg}' }, '*');
                        setTimeout(() => window.close(), 5000);
                    </script>
                </body>
            </html>
        `);
    }
});

// ─── 6. CRUD y Lógica de Nuevas Características ─────────────────────────────

// --- REGLAS ---
router.get('/rules/:accountId', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const rules = await EmailRule.find({ accountId: req.params.accountId, usuarioRef: req.user._id });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo reglas' });
    }
});

router.post('/rules/:accountId', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { name, trigger, conditionValue, action, actionValue } = req.body;
        const newRule = new EmailRule({
            usuarioRef: req.user._id,
            accountId: req.params.accountId,
            name, trigger, conditionValue, action, actionValue
        });
        await newRule.save();
        res.status(201).json(newRule);
    } catch (err) {
        res.status(500).json({ message: 'Error creando regla' });
    }
});

router.delete('/rules/:accountId/:ruleId', protect, authorize('social_webmail'), async (req, res) => {
    try {
        await EmailRule.findOneAndDelete({ _id: req.params.ruleId, accountId: req.params.accountId, usuarioRef: req.user._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando regla' });
    }
});

// --- QUICK STEPS ---
router.get('/quicksteps', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const steps = await EmailQuickStep.find({ usuarioRef: req.user._id });
        res.json(steps);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo Quick Steps' });
    }
});

router.post('/quicksteps', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { name, icon, actions } = req.body;
        const newStep = new EmailQuickStep({
            usuarioRef: req.user._id,
            name, icon, actions
        });
        await newStep.save();
        res.status(201).json(newStep);
    } catch (err) {
        res.status(500).json({ message: 'Error creando Quick Step' });
    }
});

router.delete('/quicksteps/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        await EmailQuickStep.findOneAndDelete({ _id: req.params.id, usuarioRef: req.user._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando Quick Step' });
    }
});

router.post('/quickstep/:accountId/:uid/apply', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX', quickStepId } = req.body;
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        const step = await EmailQuickStep.findOne({ _id: quickStepId, usuarioRef: req.user._id });
        if (!account || !step) return res.status(404).json({ message: 'Cuenta o Quick Step no encontrado' });

        const client = await getImapClient(account);
        let lock = await client.getMailboxLock(folder);
        try {
            for (const act of step.actions) {
                if (act.type === 'seen') {
                    await client.messageFlagsAdd(req.params.uid, ['\\Seen'], { uid: true });
                } else if (act.type === 'unseen') {
                    await client.messageFlagsRemove(req.params.uid, ['\\Seen'], { uid: true });
                } else if (act.type === 'flag') {
                    await client.messageFlagsAdd(req.params.uid, ['\\Flagged'], { uid: true });
                } else if (act.type === 'unflag') {
                    await client.messageFlagsRemove(req.params.uid, ['\\Flagged'], { uid: true });
                } else if (act.type === 'delete') {
                    await client.messageFlagsAdd(req.params.uid, ['\\Deleted'], { uid: true });
                    await client.mailboxClose();
                } else if (act.type === 'move') {
                    await client.messageMove(req.params.uid, act.value, { uid: true });
                }
            }
        } finally {
            if (lock) lock.release();
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error ejecutando Quick Step', details: err.message });
    }
});

// --- TAREAS (TASKS) ---
router.get('/tasks', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const tasks = await EmailTask.find({ usuarioRef: req.user._id }).sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo tareas' });
    }
});

router.post('/tasks', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { title, dueDate, priority, emailUid } = req.body;
        const newTask = new EmailTask({
            usuarioRef: req.user._id,
            title, dueDate, priority, emailUid
        });
        await newTask.save();
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ message: 'Error creando tarea' });
    }
});

router.patch('/tasks/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { completed, priority, title } = req.body;
        const task = await EmailTask.findOneAndUpdate(
            { _id: req.params.id, usuarioRef: req.user._id },
            { $set: { completed, priority, title } },
            { new: true }
        );
        res.json(task);
    } catch (err) {
        res.status(500).json({ message: 'Error actualizando tarea' });
    }
});

router.delete('/tasks/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        await EmailTask.findOneAndDelete({ _id: req.params.id, usuarioRef: req.user._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando tarea' });
    }
});

// --- NOTAS (NOTES) ---
router.get('/notes', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const notes = await EmailNote.find({ usuarioRef: req.user._id }).sort({ updatedAt: -1 });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo notas' });
    }
});

router.post('/notes', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { id, content, color } = req.body;
        let note;
        if (id) {
            note = await EmailNote.findOneAndUpdate(
                { _id: id, usuarioRef: req.user._id },
                { $set: { content, color } },
                { new: true }
            );
        } else {
            note = new EmailNote({
                usuarioRef: req.user._id,
                content, color
            });
            await note.save();
        }
        res.status(200).json(note);
    } catch (err) {
        res.status(500).json({ message: 'Error guardando nota' });
    }
});

router.delete('/notes/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        await EmailNote.findOneAndDelete({ _id: req.params.id, usuarioRef: req.user._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando nota' });
    }
});

// --- CONTACTOS (CONTACTS / ADDRESS BOOK) ---
router.get('/contacts', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const contacts = await EmailContact.find({ usuarioRef: req.user._id }).sort({ name: 1 });
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo contactos' });
    }
});

// --- DIRECTORIO 360 (Captura de Talento) ---
router.get('/directory', protect, authorize('social_webmail'), async (req, res) => {
    try {
        // Obtenemos candidatos activos que tengan un email registrado
        const directory = await Candidato.find({
            empresaRef: req.user.empresaRef || req.user._id,
            isActive: true,
            email: { $ne: null, $ne: '' }
        }).select('fullName email position departamento area status').lean();

        res.json(directory);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo directorio 360', error: err.message });
    }
});

router.post('/contacts', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { name, email, phone, company, category } = req.body;
        const newContact = new EmailContact({
            usuarioRef: req.user._id,
            empresaRef: req.user.empresaRef || req.user._id,
            name, email, phone, company, category
        });
        await newContact.save();
        res.status(201).json(newContact);
    } catch (err) {
        res.status(500).json({ message: 'Error creando contacto' });
    }
});

router.delete('/contacts/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        await EmailContact.findOneAndDelete({ _id: req.params.id, usuarioRef: req.user._id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando contacto' });
    }
});

// --- ENVÍO PROGRAMADO (SCHEDULED SEND) ---
router.get('/scheduled/:accountId', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const pending = await EmailScheduled.find({ 
            accountId: req.params.accountId, 
            usuarioRef: req.user._id,
            sent: false 
        }).sort({ sendAt: 1 });
        res.json(pending);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo correos programados' });
    }
});

router.post('/send-scheduled/:accountId', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { to, cc, bcc, subject, html, attachments, sendAt, importance } = req.body;
        const newScheduled = new EmailScheduled({
            usuarioRef: req.user._id,
            accountId: req.params.accountId,
            to, cc, bcc, subject, html, attachments, sendAt, importance
        });
        await newScheduled.save();
        res.status(201).json(newScheduled);
    } catch (err) {
        res.status(500).json({ message: 'Error programando envío de correo', details: err.message });
    }
});

// --- FUERA DE OFICINA (OUT OF OFFICE) ---
router.post('/accounts/:id/outofoffice', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { enabled, message, startDate, endDate } = req.body;
        const account = await EmailAccount.findOneAndUpdate(
            { _id: req.params.id, usuarioRef: req.user._id },
            { $set: { outOfOffice: { enabled, message, startDate, endDate } } },
            { new: true }
        );
        res.json(account);
    } catch (err) {
        res.status(500).json({ message: 'Error guardando fuera de oficina' });
    }
});

// --- ADD-INS (COMPLEMENTOS) ---
router.post('/accounts/:id/addins', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { activeAddins } = req.body;
        const account = await EmailAccount.findOneAndUpdate(
            { _id: req.params.id, usuarioRef: req.user._id },
            { $set: { activeAddins } },
            { new: true }
        );
        res.json(account);
    } catch (err) {
        res.status(500).json({ message: 'Error configurando add-ins' });
    }
});

// --- ONEDRIVE UPLOAD SIMULATION ---
router.post('/onedrive/upload', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { filename, contentType, content } = req.body;
        const mockLink = `https://onedrive.live.com/download?id=MOCK-${Math.random().toString(36).substring(2, 12)}&name=${encodeURIComponent(filename)}`;
        res.json({ success: true, downloadUrl: mockLink });
    } catch (err) {
        res.status(500).json({ message: 'Error subiendo a OneDrive' });
    }
});

module.exports = router;
