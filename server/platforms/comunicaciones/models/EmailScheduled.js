const mongoose = require('mongoose');

const EmailScheduledSchema = new mongoose.Schema({
    usuarioRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlatformUser',
        required: true
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmailAccount',
        required: true
    },
    to: {
        type: String,
        required: true,
        trim: true
    },
    cc: {
        type: String,
        default: ''
    },
    bcc: {
        type: String,
        default: ''
    },
    importance: {
        type: String,
        enum: ['high', 'normal', 'low'],
        default: 'normal'
    },
    subject: {
        type: String,
        default: ''
    },
    html: {
        type: String,
        default: ''
    },
    attachments: [{
        filename: String,
        contentType: String,
        size: Number,
        content: String // Base64 Content
    }],
    sendAt: {
        type: Date,
        required: true
    },
    sent: {
        type: Boolean,
        default: false
    },
    error: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailScheduled', EmailScheduledSchema);
