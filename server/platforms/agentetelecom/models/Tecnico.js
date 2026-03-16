const mongoose = require('mongoose');

const TecnicoSchema = new mongoose.Schema({
  // 1. Identificación
  rut: { type: String, required: true },
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  nombres: { type: String, required: true },
  apellidos: { type: String, required: true },
  nombre: { type: String }, // Campo compuesto (legacy/display)
  fechaNacimiento: { type: Date },
  nacionalidad: { type: String, default: 'CHILENA' },
  estadoCivil: { type: String },

  // 2. Contacto & Domicilio
  calle: { type: String },
  numero: { type: String },
  deptoBlock: { type: String },
  comuna: { type: String },
  region: { type: String },
  email: { type: String },
  telefono: { type: String },

  // 3. Contractual & Operativo
  cargo: { type: String },
  ceco: { type: String },             // Nuevo: Centro de Costo
  subCeco: { type: String },
  area: { type: String },
  departamento: { type: String },
  sede: { type: String },             // Nuevo: Sede asignada
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto' }, // Nuevo: Vínculo Proyecto 360
  mandantePrincipal: { type: String }, // Nuevo: Mandante
  fechaIngreso: { type: Date },
  tipoContrato: { type: String },
  duracionContrato: { type: String },
  fechaTerminoCalculada: { type: Date },
  usuarioToa: { type: String },
  claveToa: { type: String },
  operativo: { type: String, default: 'SI' },

  // --- NUEVA GESTIÓN DE ESTADOS ---
  estadoActual: {
    type: String,
    enum: [
      'OPERATIVO',
      'VACACIONES',
      'LICENCIA MEDICA',
      'PERMISO CON GOCE',
      'PERMISO SIN GOCE',
      'AUSENTE',
      'FINIQUITADO'
    ],
    default: 'OPERATIVO'
  },
  estadoObservacion: { type: String }, // Detalles, ej: "Licencia x 7 días"
  fechaInicioEstado: { type: Date },
  fechaFinEstado: { type: Date },

  // Finiquito
  fechaFiniquito: { type: Date },
  motivoSalida: { type: String },

  // 4. Previsión & Salud
  previsionSalud: { type: String },
  isapreNombre: { type: String },
  valorPlan: { type: String },
  monedaPlan: { type: String },
  afp: { type: String },
  pensionado: { type: String },
  tieneCargas: { type: String },
  listaCargas: [{
    rut: String,
    nombre: String,
    parentesco: String
  }],

  // 5. Financiero
  banco: { type: String },
  tipoCuenta: { type: String },
  numeroCuenta: { type: String },
  sueldoBase: { type: Number },
  tipoBonificacion: { type: String },
  montoBonoFijo: { type: Number },
  descripcionBonoVariable: { type: String },

  // 6. Otros
  requiereLicencia: { type: String },
  fechaVencimientoLicencia: { type: Date },

  // 7. Flota (Legacy / Direct)
  patente: { type: String },
  marcaVehiculo: { type: String },
  modeloVehiculo: { type: String },
  anioVehiculo: { type: String },
  vehiculoAsignado: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },

  // 8. Herramientas y Activos
  herramientas: [{
    codigo: String,
    nombre: String,
    estado: { type: String, default: 'Operativo' },
    fechaAsignacion: { type: Date, default: Date.now }
  }],

  // 9. Supervisión & Asignación
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserGenAi' }

}, { timestamps: true });

// Middleware para generar "nombre" completo si no existe
TecnicoSchema.pre('save', function (next) {
  if (this.nombres && this.apellidos) {
    this.nombre = `${this.nombres} ${this.apellidos}`;
  }
  // Auto-set estado Finiquitado si hay fecha finiquito
  if (this.fechaFiniquito && this.estadoActual !== 'FINIQUITADO') {
    this.estadoActual = 'FINIQUITADO';
  }
  next();
});

module.exports = mongoose.model('Tecnico', TecnicoSchema);