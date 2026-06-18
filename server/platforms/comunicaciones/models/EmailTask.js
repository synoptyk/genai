const mongoose = require('mongoose');

const EmailTaskSchema = new mongoose.Schema({
    usuarioRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlatformUser',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    dueDate: {
        type: Date,
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    emailUid: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailTask', EmailTaskSchema);
