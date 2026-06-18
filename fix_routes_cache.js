const fs = require('fs');
const file = 'server/platforms/comunicaciones/webmailRoutes.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const emailDetailCache = new Map();')) {
    content = content.replace(
        "const activeImapClients = new Map();",
        "const activeImapClients = new Map();\nconst emailDetailCache = new Map();"
    );

    const oldRoute = `router.get('/message/:id/:uid', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX' } = req.query;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const client = await getImapClient(account);`;

    const newRoute = `router.get('/message/:id/:uid', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { folder = 'INBOX' } = req.query;
        const account = await EmailAccount.findOne({ _id: req.params.id, usuarioRef: req.user._id });
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        const cacheKey = \`\${account._id}_\${folder}_\${req.params.uid}\`;
        if (emailDetailCache.has(cacheKey)) {
            // Background async flag as seen
            getImapClient(account).then(async client => {
                let lock;
                try {
                    lock = await client.getMailboxLock(folder);
                    await client.messageFlagsAdd(req.params.uid, ['\\\\Seen'], { uid: true });
                } catch(e) {} finally {
                    if (lock) lock.release();
                }
            }).catch(() => {});
            return res.json(emailDetailCache.get(cacheKey));
        }

        const client = await getImapClient(account);`;

    content = content.replace(oldRoute, newRoute);

    const oldResponse = `        res.json({
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
        });
    } catch (err) {`;

    const newResponse = `        const responsePayload = {
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
    } catch (err) {`;

    content = content.replace(oldResponse, newResponse);

    fs.writeFileSync(file, content, 'utf8');
    console.log('Cache logic added to route.');
} else {
    console.log('Cache already exists.');
}
