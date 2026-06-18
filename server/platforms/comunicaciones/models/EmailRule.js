const mongoose = require('mongoose');

const EmailRuleSchema = new mongoose.Schema({
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
    name: {
        type: String,
        required: true,
        trim: true
    },
    trigger: {
        type: String,
        enum: ['from', 'subject', 'body'],
        required: true
    },
    conditionValue: {
        type: String,
        required: true,
        trim: true
    },
    action: {
        type: String,
        enum: ['move', 'category', 'auto_reply'],
        required: true
    },
    actionValue: {
        type: String,
        required: true,
        trim: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailRule', EmailRuleSchema);
