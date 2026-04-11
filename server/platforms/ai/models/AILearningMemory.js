const mongoose = require('mongoose');

const AILearningMemorySchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', index: true },
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', index: true },
  role: { type: String, trim: true },
  route: { type: String, trim: true },
  question: { type: String, required: true, trim: true },
  answer: { type: String, required: true, trim: true },
  tokens: [{ type: String, index: true }],
  intentLabel: { type: String, trim: true },
  sources: [{
    documento: { type: String, trim: true },
    titulo: { type: String, trim: true },
    relevancia: { type: Number, default: 0 }
  }],
  helpfulScore: { type: Number, default: 0 },
  usageCount: { type: Number, default: 1 },
  lastUsedAt: { type: Date, default: Date.now }
}, { timestamps: true });

AILearningMemorySchema.index({ empresaRef: 1, createdAt: -1 });
AILearningMemorySchema.index({ empresaRef: 1, tokens: 1 });

module.exports = mongoose.model('AILearningMemory', AILearningMemorySchema);
