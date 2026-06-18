const EmailScheduled = require('./models/EmailScheduled');
const EmailAccount = require('./models/EmailAccount');
const nodemailer = require('nodemailer');
const { decryptText, encryptText } = require('../../utils/cryptoUtils');
const axios = require('axios');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_MAIL_CLIENT_ID || '825211993214-placeholder.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_MAIL_CLIENT_SECRET || 'placeholder_google_secret';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_MAIL_CLIENT_ID || 'placeholder_microsoft_id';
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_MAIL_CLIENT_SECRET || 'placeholder_microsoft_secret';

async function refreshOAuth2Token(account) {
    if (account.authType !== 'oauth2') return null;
    const margin = 60 * 1000;
    if (account.accessToken && account.tokenExpiresAt && (new Date(account.tokenExpiresAt).getTime() - margin > Date.now())) {
        return account.accessToken;
    }
    const refreshToken = decryptText(account.refreshTokenEncrypted);
    if (!refreshToken) throw new Error('No refresh token available');
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
    }
    const headers = account.provider === 'microsoft' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {};
    const response = await axios.post(tokenUrl, payload, { headers });
    const data = response.data;
    account.accessToken = data.access_token;
    if (data.refresh_token) account.refreshTokenEncrypted = encryptText(data.refresh_token);
    account.tokenExpiresAt = new Date(Date.now() + (data.expires_in || 3500) * 1000);
    await account.save();
    return account.accessToken;
}

async function processScheduledEmails() {
    try {
        const now = new Date();
        const pendingEmails = await EmailScheduled.find({
            sendAt: { $lte: now },
            sent: false,
            error: null
        });

        if (pendingEmails.length === 0) return;

        console.log(`✉️ [Worker] Procesando ${pendingEmails.length} correos programados...`);

        for (const email of pendingEmails) {
            try {
                const account = await EmailAccount.findById(email.accountId);
                if (!account) {
                    email.error = 'Cuenta de correo no encontrada en plataforma';
                    await email.save();
                    continue;
                }

                let transporterConfig;
                if (account.authType === 'oauth2') {
                    const accessToken = await refreshOAuth2Token(account);
                    transporterConfig = {
                        host: account.smtpHost || (account.provider === 'google' ? 'smtp.gmail.com' : 'smtp.office365.com'),
                        port: account.smtpPort || 587,
                        secure: account.smtpSecure || false,
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
                    const pass = decryptText(account.passwordEncrypted);
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
                const mailAttachments = (email.attachments || []).map(att => ({
                    filename: att.filename,
                    content: Buffer.from(att.content, 'base64'),
                    contentType: att.contentType
                }));

                const mailOptions = {
                    from: `"${account.displayName}" <${account.email}>`,
                    to: email.to,
                    cc: email.cc,
                    bcc: email.bcc,
                    subject: email.subject,
                    html: email.html,
                    attachments: mailAttachments
                };

                if (email.importance && email.importance !== 'normal') {
                    mailOptions.headers = {
                        'Importance': email.importance,
                        'X-Priority': email.importance === 'high' ? '1' : '5',
                        'X-MSMail-Priority': email.importance === 'high' ? 'High' : 'Low'
                    };
                }

                await transporter.sendMail(mailOptions);

                email.sent = true;
                await email.save();
                console.log(`✅ [Worker] Correo programado enviado exitosamente a ${email.to}`);
            } catch (err) {
                console.error(`❌ [Worker] Error enviando correo programado ID ${email._id}:`, err.message);
                email.error = err.message;
                await email.save();
            }
        }
    } catch (globalErr) {
        console.error('❌ [Worker] Error en el worker de envío programado:', globalErr.message);
    }
}

function startScheduledEmailWorker() {
    console.log('⏰ [Worker] Iniciando worker de envío programado Genai Mail (30s interval)...');
    // Ejecutar inmediatamente una vez y luego cada 30 segundos
    processScheduledEmails().catch(() => {});
    setInterval(processScheduledEmails, 30 * 1000);
}

module.exports = { startScheduledEmailWorker };
