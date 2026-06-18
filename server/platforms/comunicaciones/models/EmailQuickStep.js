const mongoose = require('mongoose');

const EmailQuickStepSchema = new mongoose.Schema({
    usuarioRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlatformUser',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    icon: {
        type: String,
        default: 'Zap'
    },
    actions: [{
        type: {
            type: String,
            enum: ['seen', 'unseen', 'flag', 'unflag', 'delete', 'move'],
            required: true
        },
        value: {
            type: String,
            default: ''
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailQuickStep', EmailQuickStepSchema);
