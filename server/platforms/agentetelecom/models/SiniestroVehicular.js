const mongoose = require('mongoose');

const SiniestroVehicularSchema = new mongoose.Schema({
  vehiculo: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo', required: true },
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  reportadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  
  // SECCIÓN 1: Conductor
  tecnico: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico' },
  conductorRut: { type: String, trim: true },
  conductorNombre: { type: String, trim: true },
  conductorCargo: { type: String, trim: true },
  conductorProyecto: { type: String, trim: true },
  conductorEmail: { type: String, trim: true },

  // SECCIÓN 2: Fecha y Lugar
  fechaSiniestro: { type: Date, required: true },
  horaSiniestro: { type: String, trim: true },
  region: { type: String, trim: true },
  comuna: { type: String, trim: true },
  calle: { type: String, trim: true },
  numero: { type: String, trim: true },
  referencia: { type: String, trim: true },
  lugar: { type: String, trim: true }, // Legacy o string concatenado

  // SECCIÓN 3: Motivo Daño
  motivoDano: { type: String, enum: ['Colisión con tercero', 'Colisión con objeto', 'Robo', 'Otro'], default: 'Otro' },
  motivoEspecifico: { type: String, trim: true }, // Cuando seleccionan Otro

  // Terceros
  terceroRut: { type: String, trim: true },
  terceroNombre: { type: String, trim: true },
  terceroPatente: { type: String, trim: true },
  terceroResponsabilidad: { type: String, trim: true }, // 'Nuestra', 'Del Tercero', 'Compartida', 'No definida'
  fotosTercero: [{ type: String }], // Array de base64 o urls

  // SECCIÓN 4: Gravedad y Daño
  gravedad: { type: String, enum: ['Leve', 'Moderado', 'Grave', 'Pérdida Total'], default: 'Moderado' },
  tipoDano: { type: String, enum: ['Carrocería', 'Cristales', 'Accesorio', 'Otro'] },
  danoEspecifico: { type: String, trim: true },
  descripcion: { type: String },

  // SECCIÓN 5 y 6: Evidencia
  fotoLicenciaFrontal: { type: String }, // Base64 o url
  fotoLicenciaPosterior: { type: String }, // Base64 o url
  fotos: [{ type: String }], // Array de base64 o urls, max 4
  
  // SECCIÓN 7: Quién Reporta
  quienReportaTipo: { type: String, enum: ['Involucrado', 'Supervisor', 'Administrador de Flota'], default: 'Involucrado' },
  quienReportaRut: { type: String, trim: true },
  quienReportaNombre: { type: String, trim: true },
  quienReportaCargo: { type: String, trim: true },

  // SECCIÓN 8: Firma y Georreferencia
  firmaColaborador: { type: String }, // Base64
  ubicacionGeo: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    timestamp: Date
  },
  
  // Gestión de reparación (Gestión posterior)
  estadoReparacion: { type: String, enum: ['Reportado', 'En Taller', 'Reparado', 'Dado de Baja'], default: 'Reportado' },
  tallerAsignado: { type: String, trim: true },
  costoEstimado: { type: Number, default: 0 },
  fechaResolucion: { type: Date },
  siniestroSeguroDeclarado: { type: Boolean, default: false },
  numeroSiniestroSeguro: { type: String, trim: true },
  
  observacionesAdicionales: { type: String },
  
  // Evaluación Automática GenAI
  evaluacionIA: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('SiniestroVehicular', SiniestroVehicularSchema);

