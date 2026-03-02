const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserGenAiSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },

    // Rol: ceo_genai = super admin, admin = admin empresa, user = usuario normal
    role: {
        type: String,
        enum: ['ceo_genai', 'admin', 'supervisor_hse', 'user'],
        default: 'user'
    },

    // Multi-empresa: cada usuario pertenece a una empresa
    empresa: {
        nombre: { type: String, required: true },
        rut: { type: String },
        logo: { type: String },
        plan: { type: String, enum: ['starter', 'pro', 'enterprise'], default: 'starter' }
    },

    // Metadata
    rut: { type: String },
    cargo: { type: String },
    avatar: { type: String },
    telefono: { type: String },
    status: { type: String, enum: ['Activo', 'Inactivo', 'Suspendido'], default: 'Activo' },

    // Sesión única (anti-sharing)
    tokenVersion: { type: Number, default: 0 },

    // Reset password
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    ultimoAcceso: { type: Date }
}, { timestamps: true });

// Hash password before save
UserGenAiSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match password method
UserGenAiSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('UserGenAi', UserGenAiSchema);
