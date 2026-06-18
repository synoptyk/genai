const mongoose = require('mongoose');

const EmailContactSchema = new mongoose.Schema({
    usuarioRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlatformUser',
        required: true
    },
    empresaRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Empresa',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        default: ''
    },
    company: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        default: 'General'
    }
}, {
    timestamps: true
});

EmailContactSchema.index({ usuarioRef: 1, email: 1 });

module.exports = mongoose.model('EmailContact', EmailContactSchema);
