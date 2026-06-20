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
  proyecto: { type: String }, // Nombre del proyecto (String para Designaciones)
  mandantePrincipal: { type: String }, // Nuevo: Mandante
  fechaIngreso: { type: Date },
  tipoContrato: { type: String },
  duracionContrato: { type: String },
  fechaTerminoCalculada: { type: Date },
  usuarioToa: { type: String },
  claveToa: { type: String },
  idRecursoToa: { type: String, default: '' }, // ID Recurso de TOA — vincula órdenes con el técnico
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
      'INACTIVO',
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
  tipoBonificacion: { type: String }, // Legacy
  montoBonoFijo: { type: Number },    // Legacy
  descripcionBonoVariable: { type: String }, // Legacy
  
  // Nuevo Motor de Bonos (v5.0)
  bonosConfig: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BonoConfig' }],

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
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },

  // 10. Tallas (Ropa y Calzado)
  shirtSize: { type: String, trim: true },
  pantsSize: { type: String, trim: true },
  jacketSize: { type: String, trim: true },
  shoeSize: { type: String, trim: true },
  uniformSize: { type: String, trim: true },
  bootsSize: { type: String, trim: true }

}, { timestamps: true });

// ── ÍNDICES PARA OPTIMIZACIÓN ──────────────────────────────────────────────
TecnicoSchema.index({ rut: 1 });
TecnicoSchema.index({ empresaRef: 1 });
TecnicoSchema.index({ idRecursoToa: 1 });
TecnicoSchema.index({ rut: 1, empresaRef: 1 }); // Búsqueda frecuente

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

// ── HOOKS DE CROSS-TALKING E INTERCONEXIÓN ─────────────────────────
const handleBajaTecnico = async (doc) => {
  if (!doc) return;
  if (['INACTIVO', 'FINIQUITADO', 'BLOQUEADO'].includes(doc.estadoActual)) {
    try {
      const PlatformUser = mongoose.model('PlatformUser');
      const Almacen = mongoose.model('Almacen');
      const GpsActivo = mongoose.model('GpsActivo');
      const AuditLog = mongoose.model('AuditLog');

      // 1. Suspender al usuario de la plataforma
      const user = await PlatformUser.findOneAndUpdate(
        { rut: doc.rut, empresaRef: doc.empresaRef },
        { status: 'Suspendido' }
      );

      if (user) {
        await AuditLog.create({
          usuarioRef: user._id,
          empresaRef: doc.empresaRef,
          accion: 'SUSPENSION_AUTOMATICA_POR_BAJA',
          modulo: 'Recursos Humanos',
          detalles: { rut: doc.rut, estadoTecnico: doc.estadoActual }
        }).catch(err => console.error("Error creating AuditLog", err));
      }

      // 2. Liberar existencias hacia la Bodega Central y bloquear la bodega técnica
      const almacenesTecnico = await Almacen.find({ tecnicoRef: doc._id, empresaRef: doc.empresaRef });
      if (almacenesTecnico.length > 0) {
        const bodegaCentral = await Almacen.findOne({ tipo: 'Central', empresaRef: doc.empresaRef });
        if (bodegaCentral) {
          const StockNivel = mongoose.model('StockNivel');
          const Movimiento = mongoose.model('Movimiento');
          const Producto = mongoose.model('Producto');

          for (const almacenTec of almacenesTecnico) {
            const stocks = await StockNivel.find({ almacenRef: almacenTec._id, empresaRef: doc.empresaRef });
            for (const stock of stocks) {
              const qtyN = stock.cantidadNuevo || 0;
              const qtyUB = stock.cantidadUsadoBueno || 0;
              const qtyUM = stock.cantidadUsadoMalo || 0;
              const qtyM = stock.cantidadMerma || 0;

              const totalToTransfer = qtyN + qtyUB + qtyUM + qtyM;

              if (totalToTransfer > 0) {
                await Movimiento.create({
                  tipo: 'REVERSA',
                  productoRef: stock.productoRef,
                  cantidad: totalToTransfer,
                  estadoProducto: qtyN > 0 ? 'Nuevo' : (qtyUB > 0 ? 'Usado Bueno' : 'Usado Malo'),
                  almacenOrigen: almacenTec._id,
                  almacenDestino: bodegaCentral._id,
                  motivo: `Devolución automática por baja/bloqueo de técnico ${doc.rut}`,
                  documentoReferencia: 'AUTO-REVERSA-BAJA',
                  usuarioRef: user ? user._id : null,
                  empresaRef: doc.empresaRef
                });

                await StockNivel.findOneAndUpdate(
                  { productoRef: stock.productoRef, almacenRef: bodegaCentral._id, empresaRef: doc.empresaRef },
                  { $inc: { 
                      cantidadNuevo: qtyN, 
                      cantidadUsadoBueno: qtyUB, 
                      cantidadUsadoMalo: qtyUM, 
                      cantidadMerma: qtyM 
                  } },
                  { upsert: true }
                );

                await StockNivel.updateOne(
                  { _id: stock._id },
                  { $set: { cantidadNuevo: 0, cantidadUsadoBueno: 0, cantidadUsadoMalo: 0, cantidadMerma: 0 } }
                );
                
                if (qtyN + qtyUB > 0) {
                  await Producto.findOneAndUpdate(
                      { _id: stock.productoRef, empresaRef: doc.empresaRef },
                      { $inc: { stockActual: qtyN + qtyUB } }
                  );
                }
              }
            }
            
            almacenTec.status = 'Inactivo';
            await almacenTec.save();
          }
        } else {
            await Almacen.updateMany(
                { tecnicoRef: doc._id, empresaRef: doc.empresaRef },
                { status: 'Inactivo' }
            );
        }
      }

      // 3. Desactivar GPS asociado
      await GpsActivo.updateMany(
        { 'vinculadoA.tecnicoRef': doc._id, empresaRef: doc.empresaRef },
        { isActive: false, estado: 'APAGADO' }
      );

    } catch (error) {
      console.error('[Cross-Talking Error] Error en handleBajaTecnico:', error);
    }
  }
};

TecnicoSchema.post('save', async function(doc) {
  await handleBajaTecnico(doc);
});

TecnicoSchema.post('findOneAndUpdate', async function(doc) {
  await handleBajaTecnico(doc);
});

module.exports = mongoose.model('Tecnico', TecnicoSchema);