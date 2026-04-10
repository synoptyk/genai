const mongoose = require('mongoose');

const ModuloCursoSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  duracionMin: { type: Number, default: 0, min: 0 },
  tipoContenido: { type: String, enum: ['Video', 'Documento', 'Quiz', 'Clase'], default: 'Documento' },
  recursoUrl: { type: String, trim: true }
}, { _id: false });

const Curso360Schema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  titulo: { type: String, required: true, trim: true },
  descripcion: { type: String, trim: true },
  categoria: { type: String, trim: true, default: 'General' },
  obligatorioParaRoles: { type: [String], default: [] },
  modulos: { type: [ModuloCursoSchema], default: [] },
  horasObjetivo: { type: Number, default: 0, min: 0 },
  estado: { type: String, enum: ['Borrador', 'Publicado', 'Archivado'], default: 'Borrador' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

module.exports = mongoose.model('Curso360', Curso360Schema);
