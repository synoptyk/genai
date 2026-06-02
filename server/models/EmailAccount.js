const mongoose = require('mongoose');

const EmailAccountSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    usuarioRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },

    // Account credentials
    email: { type: String, required: true },
    displayName: { type: String },
    
    // IMAP (receive)
    imapHost: { type: String, required: true },
    imapPort: { type: Number, default: 993 },
    imapSecure: { type: Boolean, default: true },
    imapUser: { type: String },
    imapPassword: { type: String }, // stored encrypted in production

    // SMTP (send)
    smtpHost: { type: String, required: true },
    smtpPort: { type: Number, default: 465 },
    smtpSecure: { type: Boolean, default: true },
    smtpUser: { type: String },
    smtpPassword: { type: String },

    // OAuth2 optional (for Gmail / M365)
    provider: { type: String, enum: ['imap', 'gmail', 'microsoft'], default: 'imap' },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiry: { type: Date },

    isActive: { type: Boolean, default: true },
    lastSyncAt: { type: Date },
    signature: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('EmailAccount', EmailAccountSchema);
