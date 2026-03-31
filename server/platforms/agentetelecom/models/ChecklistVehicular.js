const mongoose = require('mongoose');

const ChecklistVehicularSchema = new mongoose.Schema({
    vehiculo: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo', required: true },
    tecnico: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico', required: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },

    // --- CONTEXTO ---
    fecha: { type: Date, default: Date.now },
    proyecto: { type: String, trim: true },
    lugar: { type: String, trim: true },
    tipo: { type: String, enum: ['Asignación', 'Devolución', 'Inspección Rutinaria'], default: 'Asignación' },
    kmActual: { type: Number },
    nivelCombustible: { type: String, enum: ['Reserva', '1/4', '1/2', '3/4', 'Lleno'] },

    // --- DETALLES TÉCNICOS ---
    items: {
        // Exteriores
        luces: { type: String, default: 'OK' },
        lucesIntermitentes: { type: String, default: 'OK' },
        lucesReversa: { type: String, default: 'OK' },
        limpiaParabrisas: { type: String, default: 'OK' },
        espejos: { type: String, default: 'OK' },
        vidrios: { type: String, default: 'OK' },
        carroceria: { type: String, default: 'OK' },
        neumaticos: { type: String, default: 'OK' },
        // Interiores / Motor / Seguridad
        bocina: { type: String, default: 'OK' },
        cinturones: { type: String, default: 'OK' },
        aireAcondicionado: { type: String, default: 'OK' },
        nivelAceite: { type: String, default: 'OK' },
        nivelRefrigerante: { type: String, default: 'OK' },
        nivelLiquidoFrenos: { type: String, default: 'OK' },
        estadoBateria: { type: String, default: 'OK' },
        chalecoReflectante: { type: String, default: 'OK' },
        // Documentos
        permisoCirculacion: { type: String, default: 'OK' },
        seguroObligatorio: { type: String, default: 'OK' },
        revisionTecnica: { type: String, default: 'OK' }
    },
    // Almacena descripción de fallas: { "luces": "Foco izquierdo quebrado", ... }
    detallesItems: { type: Map, of: String },

    // --- EVIDENCIA ---
    fotos: {
        frontal: { type: String },
        trasera: { type: String },
        lateralIzq: { type: String },
        lateralDer: { type: String },
        tablero: { type: String },
        adicionales: [{ type: String }]
    },

    observaciones: { type: String },
    coordenadas: {
        lat: { type: Number },
        lng: { type: Number }
    },

    // --- FIRMAS Y VALIDACIÓN ---
    firmaColaborador: { type: String }, // Base64 del canvas — Técnico/Colaborador
    firmaSupervisor: { type: String },  // Base64 del canvas — Supervisor
    emailPersonal: { type: String, trim: true },
    qrCodeId: { type: String, unique: true }, // ID único para validación externa

    estado: { type: String, enum: ['Completado', 'Pendiente'], default: 'Completado' }
}, { timestamps: true });

module.exports = mongoose.model('ChecklistVehicular', ChecklistVehicularSchema);
