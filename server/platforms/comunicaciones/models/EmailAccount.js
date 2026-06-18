const mongoose = require('mongoose');

const EmailAccountSchema = new mongoose.Schema({
    usuarioRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true
    },
    empresaRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Empresa',
        required: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    imapHost: {
        type: String,
        required: function() { return this.authType === 'basic'; }
    },
    imapPort: {
        type: Number,
        default: 993
    },
    imapSecure: {
        type: Boolean,
        default: true
    },
    smtpHost: {
        type: String,
        required: function() { return this.authType === 'basic'; }
    },
    smtpPort: {
        type: Number,
        default: 465
    },
    smtpSecure: {
        type: Boolean,
        default: true
    },
    imapUser: {
        type: String,
        trim: true
    },
    smtpUser: {
        type: String,
        trim: true
    },
    // Contraseña encriptada con cryptoUtils.js (solo para 'basic')
    passwordEncrypted: {
        type: String,
        required: function() { return this.authType === 'basic' && !this.imapPassword; }
    },
    // Campos heredados (legacy) en texto plano
    imapPassword: {
        type: String,
        default: null
    },
    smtpPassword: {
        type: String,
        default: null
    },
    // Campos para OAuth2
    authType: {
        type: String,
        enum: ['basic', 'oauth2'],
        default: 'basic'
    },
    provider: {
        type: String,
        enum: ['google', 'microsoft', 'custom'],
        default: 'custom'
    },
    refreshTokenEncrypted: {
        type: String,
        default: null
    },
    accessToken: {
        type: String,
        default: null
    },
    tokenExpiresAt: {
        type: Date,
        default: null
    },
    signature: {
        type: String,
        default: ''
    },
    // Perfil completo de firma (datos + HTML generado)
    signatureProfile: {
        nombre:        { type: String, default: '' },
        cargo:         { type: String, default: '' },
        phone:         { type: String, default: '' },
        address:       { type: String, default: '' },
        logo:          { type: String, default: '' },   // URL del logo
        website:       { type: String, default: '' },
        styleKey:      { type: String, default: 'corporativa' },
        signatureHtml: { type: String, default: '' }    // HTML final guardado
    },
    // Contenedor de múltiples firmas guardadas
    savedSignatures: [{
        id:            { type: String, required: true },
        name:          { type: String, default: 'Firma Guardada' },
        nombre:        { type: String, default: '' },
        cargo:         { type: String, default: '' },
        phone:         { type: String, default: '' },
        address:       { type: String, default: '' },
        logo:          { type: String, default: '' },
        website:       { type: String, default: '' },
        styleKey:      { type: String, default: 'corporativa' },
        signatureHtml: { type: String, default: '' },
        createdAt:     { type: Date, default: Date.now }
    }],
    outOfOffice: {
        enabled: { type: Boolean, default: false },
        message: { type: String, default: '' },
        startDate: { type: Date, default: null },
        endDate: { type: Date, default: null }
    },
    activeAddins: {
        type: [String],
        default: []
    },
    status: {
        type: String,
        enum: ['active', 'error'],
        default: 'active'
    },
    lastError: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Índice para buscar rápidamente las cuentas de un usuario
EmailAccountSchema.index({ usuarioRef: 1 });

module.exports = mongoose.model('EmailAccount', EmailAccountSchema);
