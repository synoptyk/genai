const mongoose = require('mongoose');

const AiMemorySchema = new mongoose.Schema({
  empresaRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chatSessionId: {
    type: String,
    required: true,
    index: true,
  },
  turns: [{
    role: { type: String, enum: ['user', 'model', 'assistant', 'system', 'tool', 'function'], required: true },
    content: { type: String },
    name: { type: String }, // For function calls
    tool_call_id: { type: String }, // For tool responses
    tool_calls: { type: mongoose.Schema.Types.Mixed }, // For tool invocations
    functionCall: { type: mongoose.Schema.Types.Mixed }, // Gemini functionCall
    functionResponse: { type: mongoose.Schema.Types.Mixed }, // Gemini functionResponse
    timestamp: { type: Date, default: Date.now }
  }],
  lecciones: [{
    type: String, // Claves de aprendizaje extraídas de la sesión
  }],
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '14d' } // Auto expirar sesiones después de 14 días para no llenar DB
  }
}, { timestamps: true });

// Compound index to quickly find user sessions
AiMemorySchema.index({ empresaRef: 1, userId: 1, chatSessionId: 1 });

module.exports = mongoose.models.AiMemory || mongoose.model('AiMemory', AiMemorySchema);
