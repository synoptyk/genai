const mongoose = require('mongoose');

const ManualKnowledgeSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  sourceFile: { type: String, required: true, unique: true, index: true },
  moduleKey: { type: String, required: true, index: true },
  title: { type: String, required: true },
  summary: { type: String, default: '' },
  content: { type: String, required: true },
  tokens: [{ type: String, index: true }],
  coverageTags: [{ type: String }],
  active: { type: Boolean, default: true, index: true },
  version: { type: Number, default: 1 },
  lastSyncedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ManualKnowledge', ManualKnowledgeSchema);
