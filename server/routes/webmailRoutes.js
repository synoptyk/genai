const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const EmailAccount = require('../models/EmailAccount');
const { protect } = require('../platforms/auth/authMiddleware');

// ─── Helper: create IMAP client ─────────────────────────────────────────────
const createImapClient = (account) => new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: {
        user: account.imapUser || account.email,
        pass: account.imapPassword,
    },
    logger: false,
    disableAutoIdle: true,
    tls: { rejectUnauthorized: false },
    emitLogs: false,
});

// ─── Helper: create SMTP transporter ────────────────────────────────────────
const createSmtpTransport = (account) => nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
        user: account.smtpUser || account.email,
        pass: account.smtpPassword,
    },
    tls: { rejectUnauthorized: false },
});

// ─── GET /accounts ─── List all accounts for user ───────────────────────────
router.get('/accounts', protect, async (req, res) => {
    try {
        const accounts = await EmailAccount.find({
            usuarioRef: req.user._id,
            isActive: true,
        }).select('-imapPassword -smtpPassword -accessToken -refreshToken');
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /accounts ─── Register new account ────────────────────────────────
router.post('/accounts', protect, async (req, res) => {
    try {
        const { email, displayName, imapHost, imapPort, imapSecure, imapUser, imapPassword,
                smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, signature } = req.body;

        if (!email || !imapHost || !smtpHost || !imapPassword) {
            return res.status(422).json({ message: 'Faltan campos requeridos: email, imapHost, smtpHost, contraseña.' });
        }

        // Test IMAP connection (non-blocking — warn but save anyway)
        let connectionWarning = null;
        const testClient = new ImapFlow({
            host: imapHost,
            port: imapPort || 993,
            secure: imapSecure !== false,
            auth: { user: imapUser || email, pass: imapPassword },
            logger: false,
            tls: { rejectUnauthorized: false },
            emitLogs: false,
        });
        try {
            await testClient.connect();
            await testClient.logout();
        } catch (e) {
            connectionWarning = `Advertencia IMAP: ${e.message}`;
        }

        const account = await EmailAccount.create({
            empresaRef: req.user.empresaRef,
            usuarioRef: req.user._id,
            email, displayName, imapHost,
            imapPort: imapPort || 993,
            imapSecure: imapSecure !== false,
            imapUser: imapUser || email,
            imapPassword,
            smtpHost,
            smtpPort: smtpPort || 465,
            smtpSecure: smtpSecure !== false,
            smtpUser: smtpUser || email,
            smtpPassword,
            signature,
        });

        const { imapPassword: _, smtpPassword: __, ...safeAccount } = account.toObject();
        res.status(201).json({ ...safeAccount, connectionWarning });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// ─── DELETE /accounts/:id ────────────────────────────────────────────────────
router.delete('/accounts/:id', protect, async (req, res) => {
    try {
        await EmailAccount.findOneAndUpdate(
            { _id: req.params.id, usuarioRef: req.user._id },
            { isActive: false }
        );
        res.json({ message: 'Cuenta eliminada' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /messages/:accountId ─── Fetch folder messages ─────────────────────
router.get('/messages/:accountId', protect, async (req, res) => {
    const { folder = 'INBOX', page = 1, limit = 30 } = req.query;
    try {
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = createImapClient(account);
        await client.connect();

        const mailbox = await client.mailboxOpen(folder);
        const total = mailbox.exists;

        const messages = [];
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // Calculate range from newest
        const end = total - (pageNum - 1) * limitNum;
        const start = Math.max(1, end - limitNum + 1);

        if (end >= start && total > 0) {
            for await (const msg of client.fetch(`${start}:${end}`, {
                uid: true,
                flags: true,
                envelope: true,
                bodyStructure: true,
                internalDate: true,
            })) {
                messages.unshift({
                    uid: msg.uid,
                    seq: msg.seq,
                    subject: msg.envelope?.subject || '(Sin asunto)',
                    from: msg.envelope?.from?.[0] || {},
                    to: msg.envelope?.to || [],
                    date: msg.internalDate,
                    flags: [...(msg.flags || [])],
                    seen: msg.flags?.has('\\Seen'),
                    flagged: msg.flags?.has('\\Flagged'),
                });
            }
        }

        await client.logout();

        res.json({ messages: messages.reverse(), total, folder });
    } catch (err) {
        console.error('IMAP fetch error:', err.message);
        res.status(500).json({ message: `Error leyendo correos: ${err.message}` });
    }
});

// ─── GET /message/:accountId/:uid ─── Fetch single message body ─────────────
router.get('/message/:accountId/:uid', protect, async (req, res) => {
    const { folder = 'INBOX' } = req.query;
    try {
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = createImapClient(account);
        await client.connect();
        await client.mailboxOpen(folder);

        const uid = parseInt(req.params.uid);
        let emailData = null;

        for await (const msg of client.fetch({ uid: uid }, {
            uid: true,
            flags: true,
            envelope: true,
            source: true,
        }, { uid: true })) {
            const source = msg.source?.toString() || '';

            // Simple HTML extraction from source
            let htmlBody = '';
            let textBody = '';

            const htmlMatch = source.match(/Content-Type: text\/html[^]*?(?=\r\n\r\n)([\s\S]*?)(?=--|\Z)/i);
            const textMatch = source.match(/Content-Type: text\/plain[^]*?(?=\r\n\r\n)([\s\S]*?)(?=--|\Z)/i);

            if (htmlMatch) htmlBody = htmlMatch[0].split(/\r\n\r\n/)[1] || '';
            if (textMatch) textBody = textMatch[0].split(/\r\n\r\n/)[1] || '';

            emailData = {
                uid: msg.uid,
                subject: msg.envelope?.subject || '(Sin asunto)',
                from: msg.envelope?.from?.[0] || {},
                to: msg.envelope?.to || [],
                cc: msg.envelope?.cc || [],
                date: msg.envelope?.date,
                flags: [...(msg.flags || [])],
                seen: msg.flags?.has('\\Seen'),
                htmlBody,
                textBody,
            };
        }

        // Mark as read
        await client.messageFlagsAdd({ uid: uid }, ['\\Seen'], { uid: true });

        await client.logout();

        if (!emailData) return res.status(404).json({ message: 'Mensaje no encontrado' });
        res.json(emailData);
    } catch (err) {
        console.error('IMAP message error:', err.message);
        res.status(500).json({ message: `Error leyendo mensaje: ${err.message}` });
    }
});

// ─── GET /folders/:accountId ─── List folders ───────────────────────────────
router.get('/folders/:accountId', protect, async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = createImapClient(account);
        await client.connect();
        const list = await client.list();
        await client.logout();

        res.json(list.map(f => ({ name: f.name, path: f.path, flags: [...(f.flags || [])] })));
    } catch (err) {
        res.status(500).json({ message: `Error listando carpetas: ${err.message}` });
    }
});

// ─── POST /send/:accountId ─── Send email ───────────────────────────────────
router.post('/send/:accountId', protect, async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const { to, cc, bcc, subject, html, text, replyTo } = req.body;

        const transport = createSmtpTransport(account);

        await transport.sendMail({
            from: `"${account.displayName || account.email}" <${account.email}>`,
            to,
            cc,
            bcc,
            subject,
            html: html || `<pre>${text}</pre>`,
            text,
            replyTo,
        });

        res.json({ message: 'Correo enviado exitosamente' });
    } catch (err) {
        console.error('SMTP send error:', err.message);
        res.status(500).json({ message: `Error enviando correo: ${err.message}` });
    }
});

// ─── DELETE /message/:accountId/:uid ─── Move to trash ──────────────────────
router.delete('/message/:accountId/:uid', protect, async (req, res) => {
    const { folder = 'INBOX' } = req.query;
    try {
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = createImapClient(account);
        await client.connect();
        await client.mailboxOpen(folder);

        await client.messageFlagsAdd({ uid: parseInt(req.params.uid) }, ['\\Deleted'], { uid: true });
        await client.mailboxClose();
        await client.logout();

        res.json({ message: 'Mensaje eliminado' });
    } catch (err) {
        res.status(500).json({ message: `Error eliminando mensaje: ${err.message}` });
    }
});

// ─── PATCH /message/:accountId/:uid/flag ─── Toggle flag ────────────────────
router.patch('/message/:accountId/:uid/flag', protect, async (req, res) => {
    const { folder = 'INBOX', flag, value } = req.body;
    try {
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = createImapClient(account);
        await client.connect();
        await client.mailboxOpen(folder);

        const uid = parseInt(req.params.uid);
        if (value) {
            await client.messageFlagsAdd({ uid }, [flag], { uid: true });
        } else {
            await client.messageFlagsRemove({ uid }, [flag], { uid: true });
        }

        await client.logout();
        res.json({ message: 'Flag actualizado' });
    } catch (err) {
        res.status(500).json({ message: `Error actualizando flag: ${err.message}` });
    }
});

// ─── GET /test/:accountId ─── Test connection ────────────────────────────────
router.get('/test/:accountId', protect, async (req, res) => {
    try {
        const account = await EmailAccount.findOne({ _id: req.params.accountId, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = createImapClient(account);
        await client.connect();
        await client.logout();

        await EmailAccount.findByIdAndUpdate(req.params.accountId, { lastSyncAt: new Date() });
        res.json({ status: 'ok', message: 'Conexión exitosa' });
    } catch (err) {
        res.status(400).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
