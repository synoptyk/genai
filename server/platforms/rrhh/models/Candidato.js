const mongoose = require('mongoose');

const EducationSchema = new mongoose.Schema({
    degree: String,
    institution: String,
    year: String
});

const WorkHistorySchema = new mongoose.Schema({
    position: String,
    company: String,
    from: String,
    to: String
});

const FamiliarSchema = new mongoose.Schema({
    nombre: String,
    rut: String,
    parentesco: String,
    fechaNacimiento: Date
});

const DocumentSchema = new mongoose.Schema({
    docType: String,
    url: String,
    status: { type: String, enum: ['Pendiente', 'OK', 'Rechazado'], default: 'Pendiente' },
    uploadedAt: { type: Date, default: Date.now }
});

const InterviewSchema = new mongoose.Schema({
    scheduledDate: Date,
    location: String,
    attended: { type: Boolean, default: false },
    result: { type: String, enum: ['Pendiente', 'Aprobado', 'Reprobado', 'No Asistió'], default: 'Pendiente' },
    interviewStatus: { type: String, enum: ['Pendiente Agendar', 'Agendada', 'Confirmada', 'Realizada', 'Cancelada'], default: 'Pendiente Agendar' },
    notes: String
});

const TestSchema = new mongoose.Schema({
    testName: String,
    score: Number,
    maxScore: Number,
    passed: Boolean,
    completedAt: Date,
    notes: String
});

const AccreditationSchema = new mongoose.Schema({
    physicalExams: [{
        name: String,
        status: { type: String, enum: ['Pendiente', 'Aprobado', 'Reprobado'], default: 'Pendiente' },
        date: Date
    }],
    ppe: [{
        item: String,
        delivered: { type: Boolean, default: false },
        deliveredAt: Date
    }],
    notes: String
});

const HiringSchema = new mongoose.Schema({
    contractStartDate: Date,
    contractEndDate: Date,
    contractType: { type: String, enum: ['Indefinido', 'Plazo Fijo', 'Por Obra', 'Honorarios'], default: 'Indefinido' },
    position: String,
    salary: Number,
    managerApproval: { type: String, enum: ['Pendiente', 'Aprobado', 'Rechazado'], default: 'Pendiente' },
    approvedBy: String,
    managerNote: String
});

const HistoryEventSchema = new mongoose.Schema({
    action: String,
    description: String,
    user: String,
    timestamp: { type: Date, default: Date.now }
});

const VacacionSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['Vacaciones', 'Licencia Médica', 'Permiso Sin Goce', 'Permiso Con Goce'], default: 'Vacaciones' },
    fechaInicio: Date,
    fechaFin: Date,
    diasHabiles: Number,
    estado: { type: String, enum: ['Pendiente', 'Aprobado', 'Rechazado'], default: 'Pendiente' },
    observaciones: String,
    aprobadoPor: String,
    creadoEn: { type: Date, default: Date.now },
    // ── Flujo de aprobación multi-nivel ──
    validationRequested: { type: Boolean, default: false },
    approvalChain: [{
        id: String,
        name: String,
        position: String,
        status: { type: String, enum: ['Pendiente', 'Aprobado', 'Rechazado'], default: 'Pendiente' },
        comment: String,
        updatedAt: Date
    }],
    supervisorComment: String
});

const CandidatoSchema = new mongoose.Schema({
    // --- PERSONAL DATA ---
    fullName: { type: String, required: true, trim: true },
    rut: { type: String, required: true, trim: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    email: { type: String, trim: true, lowercase: true },
    phone: String,
    fechaNacimiento: Date,
    estadoCivil: String,
    nationality: { type: String, default: 'Chilena' },
    birthPlace: String,
    idExpiryDate: Date,
    gender: { type: String, enum: ['Masculino', 'Femenino', 'Otro', 'No Informado'], default: 'No Informado' },
    profilePic: String, // Cloudinary URL
    cvUrl: String,      // CV Document URL

    // Domicilio
    address: String,
    calle: String,
    numero: String,
    deptoBlock: String,
    comuna: String,
    region: String,

    // --- PROCESS DATA ---
    position: { type: String, required: true },
    educationLevel: String,
    ceco: String,
    area: String,
    departamento: String,
    sede: String,
    proyectoTipo: String,
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto' },
    projectName: String,
    status: {
        type: String,
        enum: [
            'En Postulación', 'Postulando',
            'En Entrevista', 'En Evaluación',
            'En Acreditación', 'En Documentación',
            'Aprobado', 'Contratado',
            'Rechazado', 'Retirado', 'Finiquitado'
        ],
        default: 'En Postulación'
    },
    source: { type: String, default: 'Captación Directa' },
    conflictOfInterest: {
        hasFamilyInCompany: { type: Boolean, default: false },
        relationship: String,
        employeeName: String
    },
    currentWorkSituation: String,
    assignedLocation: String,
    isWaitlisted: { type: Boolean, default: false },
    isDirectHire: { type: Boolean, default: false },

    // Información del Contrato
    contractType: String,
    contractStartDate: Date,
    contractDurationMonths: Number,
    contractEndDate: Date,
    nextAddendumDate: Date,
    nextAddendumDescription: String,
    contractStep: { type: Number, default: 1 }, // 1: Primer contrato, 2: Segundo anexo, etc.

    // Emergencia
    emergencyContact: String,
    emergencyPhone: String,
    emergencyEmail: String,

    interview: InterviewSchema,
    tests: [TestSchema],
    accreditation: AccreditationSchema,
    documents: [DocumentSchema],
    hiring: HiringSchema,
    vacaciones: [VacacionSchema],

    // Previsión y Salud
    previsionSalud: String,
    isapreNombre: String,
    valorPlan: String,
    monedaPlan: { type: String, default: 'UF' },
    afp: String,
    pensionado: { type: String, default: 'NO' },
    bloodType: String,
    allergies: String,
    chronicDiseases: String,
    hasDisability: { type: Boolean, default: false },
    disabilityType: String,
    tieneCargas: { type: String, default: 'NO' },
    listaCargas: [{
        fullName: String,
        rut: String,
        parentesco: String,
        fechaNacimiento: Date
    }], // Assuming FamiliarSchema is defined elsewhere or will be added.

    // Financiero
    banco: String,
    tipoCuenta: String,
    numeroCuenta: String,
    sueldoBase: Number,
    bonuses: [{
        type: String,
        amount: Number,
        description: String,
        isImponible: { type: Boolean, default: true }
    }],

    // Operativos
    requiereLicencia: { type: String, default: 'NO' },
    fechaVencimientoLicencia: Date,
    shirtSize: String,
    pantsSize: String,
    jacketSize: String,
    shoeSize: String,
    uniformSize: String, // Legacy
    bootsSize: String,   // Legacy

    // --- PROTOCOLS ---
    amonestaciones: [{
        tipo: { type: String, enum: ['Verbal', 'Escrita', 'Suspensión'], default: 'Verbal' },
        motivo: String,
        fecha: Date,
        descripcion: String,
        firmado: { type: Boolean, default: false }
    }],
    felicitaciones: [{
        motivo: String,
        fecha: Date,
        descripcion: String
    }],

    // --- AUDIT ---
    notes: [{ text: String, author: String, createdAt: { type: Date, default: Date.now } }],
    history: [HistoryEventSchema],

    // --- META ---
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

// Auto-update updatedAt
CandidatoSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Candidato', CandidatoSchema);
