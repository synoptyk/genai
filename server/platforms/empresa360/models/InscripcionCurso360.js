const mongoose = require('mongoose');

const InscripcionCurso360Schema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  cursoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso360', required: true },
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  progresoPct: { type: Number, default: 0, min: 0, max: 100 },
  notaFinal: { type: Number, min: 1, max: 7 },
  estado: { type: String, enum: ['Inscrito', 'En Progreso', 'Aprobado', 'Reprobado'], default: 'Inscrito' },
  fechaInicio: { type: Date, default: Date.now },
  fechaTermino: { type: Date },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

InscripcionCurso360Schema.index({ empresaRef: 1, cursoRef: 1, userRef: 1 }, { unique: true });

module.exports = mongoose.model('InscripcionCurso360', InscripcionCurso360Schema);
