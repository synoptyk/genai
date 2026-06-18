const mongoose = require('mongoose');

const EmailCategorySchema = new mongoose.Schema({
    usuarioRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlatformUser',
        required: true
    },
    emailUid: {
        type: String,
        required: true
    },
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmailAccount',
        required: true
    },
    category: {
        type: String,
        enum: ['prioritario', 'notificaciones', 'promociones', 'spam'],
        default: 'prioritario'
    }
}, {
    timestamps: true
});

EmailCategorySchema.index({ accountId: 1, emailUid: 1 }, { unique: true });

module.exports = mongoose.model('EmailCategory', EmailCategorySchema);
