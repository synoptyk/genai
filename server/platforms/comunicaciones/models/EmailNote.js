const mongoose = require('mongoose');

const EmailNoteSchema = new mongoose.Schema({
    usuarioRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlatformUser',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    color: {
        type: String,
        default: '#fef08a' // default light yellow
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('EmailNote', EmailNoteSchema);
