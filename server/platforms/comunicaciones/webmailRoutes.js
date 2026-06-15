const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../auth/authMiddleware');
const EmailAccount = require('./models/EmailAccount');
const PlatformUser = require('../auth/PlatformUser');
const { encryptText, decryptText } = require('../../utils/cryptoUtils');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const simpleParser = require('mailparser').simpleParser;
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

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

// Función helper para crear un cliente IMAP a partir del modelo
async function getImapClient(account) {
    if (account.authType === 'oauth2') {
        const accessToken = await refreshOAuth2Token(account);
        return new ImapFlow({
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
            account.save().catch(e => console.error("Error migrating legacy IMAP password:", e));
        }

        return new ImapFlow({
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
}

// ─── 1. Gestión de Cuentas ───────────────────────────────────────────────

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

router.get('/accounts', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const accounts = await EmailAccount.find({ usuarioRef: req.user._id }).select('-passwordEncrypted');
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ message: 'Error obteniendo cuentas' });
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
        await client.connect();
        const folders = await client.list();
        await client.logout();

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
        await client.connect();
        
        let lock = await client.getMailboxLock(folder);
        try {
            const total = client.mailbox.exists;
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

            let messages = [];
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
            res.json({ messages, total });
        } finally {
            lock.release();
        }
        await client.logout();
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

                const client = await getImapClient(account);
        await client.connect();
        
        let lock = await client.getMailboxLock(folder);
        let parsedMail;
        try {
            let rawMessage = await client.download(req.params.uid, null, { uid: true });
            parsedMail = await simpleParser(rawMessage.content);
            // Marcar como leido
            await client.messageFlagsAdd(req.params.uid, ['\\Seen'], { uid: true });
        } finally {
            lock.release();
        }
        await client.logout();

        res.json({
            subject: parsedMail.subject,
            from: parsedMail.from?.value?.[0],
            to: parsedMail.to?.value,
            cc: parsedMail.cc?.value,
            date: parsedMail.date,
            htmlBody: parsedMail.html,
            textBody: parsedMail.text,
            attachments: parsedMail.attachments.map(a => ({
                filename: a.filename,
                contentType: a.contentType,
                size: a.size
            }))
        });
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
        await client.connect();
        let lock = await client.getMailboxLock(folder);
        try {
            if (value) await client.messageFlagsAdd(req.params.uid, [flag], { uid: true });
            else await client.messageFlagsRemove(req.params.uid, [flag], { uid: true });
        } finally {
            lock.release();
        }
        await client.logout();
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
        await client.connect();
        let lock = await client.getMailboxLock(folder);
        try {
            // Eliminar moviendo a papelera, o simplemente borrando. 
            // Para simplificar, añadimos flag \Deleted
            await client.messageFlagsAdd(req.params.uid, ['\\Deleted'], { uid: true });
            await client.mailboxClose(); // expunge
        } finally {
            if (lock) lock.release();
        }
        await client.logout();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Error eliminando mensaje' });
    }
});

// ─── 3. Operaciones SMTP ──────────────────────────────────────────────────

router.post('/send/:id', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { to, cc, subject, html } = req.body;
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
                account.save().catch(e => console.error("Error migrating legacy SMTP password:", e));
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

        await transporter.sendMail({
            from: `"${account.displayName}" <${account.email}>`,
            to, cc, subject, html
        });

        // Opcional: Guardar en carpeta 'Sent' a través de IMAP (append)
        try {
            const client = await getImapClient(account);
            await client.connect();
            const sentFolder = account.provider === 'google' ? '[Gmail]/Enviados' : 'Sent';
            await client.append(sentFolder, `From: ${account.displayName} <${account.email}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html\r\n\r\n${html}`, ['\\Seen']);
            await client.logout();
        } catch(e) { console.error('Error append Sent:', e); }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error enviando correo', details: err.message });
    }
});

// ─── 4. Inteligencia Artificial (Gemini) ──────────────────────────────────

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/ai/summarize', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { text } = req.body;
        const prompt = `Eres un asistente ejecutivo avanzado. Resume el siguiente correo electrónico en 3 puntos clave accionables:\n\n${text}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        res.json({ summary: response.text });
    } catch (err) {
        res.status(500).json({ message: 'Error resumiendo' });
    }
});

router.post('/ai/draft', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { instruction, originalText } = req.body;
        let prompt = `Eres un experto asistente corporativo redactando correos profesionales. Escribe un borrador de correo con la siguiente instrucción: "${instruction}".\n`;
        if (originalText) {
            prompt += `\nEste es el correo original al que estás respondiendo:\n"${originalText}"\n`;
        }
        prompt += `\nResponde SOLO con el cuerpo del correo en formato HTML limpio. Usa lenguaje profesional y educado.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let html = response.text;
        if(html.includes('```html')) {
            html = html.split('```html')[1].split('```')[0].trim();
        }

        res.json({ draft: html });
    } catch (err) {
        res.status(500).json({ message: 'Error redactando' });
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

module.exports = router;
