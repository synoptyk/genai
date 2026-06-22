const express = require('express');
const router = express.Router();
const RegistroAsistencia = require('../models/RegistroAsistencia');
const Candidato = require('../models/Candidato');
const Tecnico = require('../../agentetelecom/models/Tecnico');
const Actividad = require('../../agentetelecom/models/Actividad');
const Turno = require('../models/Turno');
const { protect, authorize } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');
const feriadosUtil = require('../../../utils/feriadosUtil');
const { sendAttendanceNotificationEmail } = require('../../../utils/mailer');

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const crypto = require('crypto');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const LEGAL_ALLOWED_FIELDS = [
    'estado',
    'horaEntrada',
    'horaIngresoDeclarada',
    'horaSalida',
    'turnoId',
    'observacion',
    'tipoAusencia',
    'descuentaDia',
    'minutosTardanza',
    'horasExtra',
    'estadoHorasExtra',
    'horasExtraAprobadas',
    'validadoPor',
    'estadoDia',
    'syncFromProduccion'
];

const normalizeForHash = (value) => {
    if (Array.isArray(value)) return value.map(normalizeForHash);
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object') {
        const out = {};
        Object.keys(value).sort().forEach((k) => {
            out[k] = normalizeForHash(value[k]);
        });
        return out;
    }
    return value;
};

const sha256Hex = (payload) => crypto.createHash('sha256').update(payload).digest('hex');

const getLastEventHash = (registro) => {
    if (!registro) return 'GENESIS';
    if (registro.auditLog?.ultimoEventoHash) return registro.auditLog.ultimoEventoHash;
    const events = Array.isArray(registro.eventosTimeline) ? registro.eventosTimeline : [];
    const last = events.length ? events[events.length - 1] : null;
    return last?.hashActual || 'GENESIS';
};

const buildSnapshot = (registro) => {
    if (!registro) return null;
    const src = registro.toObject ? registro.toObject() : registro;
    const out = {};
    LEGAL_ALLOWED_FIELDS.forEach((field) => {
        if (src[field] !== undefined) out[field] = src[field];
    });
    out.estadoRegistro = src.estadoRegistro || 'ACTIVO';
    return out;
};

const buildAuditEvent = ({ registroActual, patch, req, tipo, observacion }) => {
    const eventTimestamp = new Date();
    const snapshotAntes = buildSnapshot(registroActual);
    const snapshotDespues = { ...(snapshotAntes || {}), ...(patch || {}) };
    const hashPrevio = getLastEventHash(registroActual);
    const hashBase = normalizeForHash({
        hashPrevio,
        tipo,
        timestamp: eventTimestamp.toISOString(),
        actor: req.user?.email || req.user?.name || 'sistema',
        snapshotDespues
    });
    const hashActual = sha256Hex(JSON.stringify(hashBase));

    return {
        tipo,
        hora: patch?.horaEntrada || patch?.horaSalida || new Date().toISOString().substring(11, 16),
        estadoSeleccionado: patch?.estado,
        observacion,
        snapshotAntes,
        snapshotDespues,
        hashPrevio,
        hashActual,
        registradoPor: req.user?.nombre || req.user?.name || req.user?.email || 'sistema',
        timestamp: eventTimestamp
    };
};

const baseAuditLog = (req, metodo = 'Web') => ({
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date(),
    metodo
});

const verifyRegistroIntegrity = (registro) => {
    const eventos = Array.isArray(registro.eventosTimeline) ? registro.eventosTimeline : [];
    let prev = 'GENESIS';
    const inconsistencias = [];

    eventos.forEach((ev, idx) => {
        const ts = ev.timestamp ? new Date(ev.timestamp) : null;
        const timestampIso = (ts && !Number.isNaN(ts.getTime())) ? ts.toISOString() : null;
        if (!timestampIso) {
            inconsistencias.push(`Evento ${idx + 1}: timestamp inválido`);
            return;
        }

        const hashBase = normalizeForHash({
            hashPrevio: ev.hashPrevio || prev,
            tipo: ev.tipo,
            timestamp: timestampIso,
            actor: ev.registradoPor || 'sistema',
            snapshotDespues: ev.snapshotDespues || {}
        });
        const expected = sha256Hex(JSON.stringify(hashBase));
        if ((ev.hashPrevio || prev) !== prev) {
            inconsistencias.push(`Evento ${idx + 1}: hashPrevio no coincide con la cadena`);
        }
        if ((ev.hashActual || '') !== expected) {
            inconsistencias.push(`Evento ${idx + 1}: hashActual inválido`);
        }
        prev = ev.hashActual || prev;
    });

    const ultimoHash = registro.auditLog?.ultimoEventoHash || null;
    if (ultimoHash && prev !== ultimoHash) {
        inconsistencias.push('ultimoEventoHash no coincide con el último evento');
    }

    return {
        ok: inconsistencias.length === 0,
        totalEventos: eventos.length,
        ultimoHashCalculado: prev,
        inconsistencias
    };
};

// ─── GET /asistencia ─ Listado (por fecha o por mes/año) ─────────────────────
router.get('/', protect, authorize('rrhh_asistencia:ver', 'op_colaborador:ver', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR, ROLES.OPERATIVO, ROLES.TECNICO), async (req, res) => {
    try {
        const { fecha, candidatoId, month, year, includeAnulados } = req.query;
        const filter = { empresaRef: req.user.empresaRef };
        if (String(includeAnulados) !== 'true') {
            filter.estadoRegistro = { $ne: 'ANULADO' };
        }
        if (candidatoId) filter.candidatoId = candidatoId;
        if (fecha) {
            // Usar UTC para coincidir con cómo se guardan las fechas
            const d = new Date(fecha);
            const inicio = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
            const fin    = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));
            filter.fecha = { $gte: inicio, $lte: fin };
        }
        if (month && year) {
            const m = Number(month);
            const y = Number(year);
            filter.fecha = {
                $gte: new Date(Date.UTC(y, m - 1, 1)),
                $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59)),
            };
        }
        const registros = await RegistroAsistencia.find(filter)
            .populate('candidatoId', 'fullName rut position cargo profilePic projectName projectId status')
            .populate('turnoId', 'nombre horaEntrada horaSalida color toleranciaTardanza diasSemana horariosPorDia')
            .sort({ fecha: 1, 'candidatoId.fullName': 1 });
        res.json(registros);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET /asistencia/resumen-periodo ─ Resumen mensual por colaborador ────────
// Usado por NominaRRHH para sincronizar días trabajados y horas extra reales
router.get('/resumen-periodo', protect, authorize('rrhh_asistencia:ver', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);
        const filter = {
            empresaRef: req.user.empresaRef,
            estadoRegistro: { $ne: 'ANULADO' },
            fecha: {
                $gte: new Date(Date.UTC(y, m - 1, 1)),
                $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59)),
            }
        };

        const registros = await RegistroAsistencia.find(filter)
            .populate('candidatoId', 'fullName rut position cargo projectName status toaId idRecursoToa contractStartDate contractEndDate fechaFiniquito')
            .populate('turnoId', 'nombre horasTrabajo colacionMinutos diasSemana horariosPorDia')
            .lean();

        // Agrupar por candidato
        const porCandidato = {};
        registros.forEach(r => {
            const cId = r.candidatoId?._id?.toString() || r.candidatoId?.toString();
            if (!cId) return;

            // Validar que el registro no sea anterior a la fecha de contrato si existe
            const startDate = r.candidatoId?.contractStartDate ? new Date(r.candidatoId.contractStartDate) : null;
            if (startDate) {
                // Eliminar horas del registro para comparar solo fecha
                const rDate = new Date(r.fecha);
                const sDate = new Date(startDate);
                sDate.setHours(0,0,0,0);
                rDate.setHours(0,0,0,0);
                if (rDate < sDate) return; // Ignorar registros previos al contrato
            }

            if (!porCandidato[cId]) {
                porCandidato[cId] = {
                    candidatoId: cId,
                    nombre: r.candidatoId?.fullName || '—',
                    rut: r.candidatoId?.rut || '',
                    cargo: r.candidatoId?.position || r.candidatoId?.cargo || '',
                    contractStartDate: r.candidatoId?.contractStartDate,
                    datosCandidato: r.candidatoId, // Persistimos los datos para cálculos de proporcionalidad
                    diasPresente:    0,
                    diasTardanza:    0,
                    diasAusente:     0,
                    diasLicencia:    0,
                    diasPermiso:     0,
                    diasVacaciones:  0,
                    diasFeriado:     0,
                    diasDomingo:     0,
                    diasNC:          0,
                    diasDescontados: 0,
                    minutosTardanzaTotal: 0,
                    horasExtraDeclaradas: 0,
                    horasExtraAprobadas:  0,
                    horasNormalesTrabajadas: 0
                };
            }
            const c = porCandidato[cId];
            switch (r.estado) {
                case 'Presente':    c.diasPresente++;   break;
                case 'Tardanza':    c.diasTardanza++;   break;
                case 'Ausente':     c.diasAusente++;    break;
                case 'Licencia':    c.diasLicencia++;   break;
                case 'Permiso':     c.diasPermiso++;    break;
                case 'Vacaciones':  c.diasVacaciones++; break;
                case 'Feriado':     c.diasFeriado++;    break;
                case 'Libre':       c.diasDomingo++;    break;
                case 'NC':          c.diasNC++;         break;
            }
            if (r.descuentaDia) c.diasDescontados++;
            if (r.estado === 'Presente' || r.estado === 'Tardanza') {
                c.horasNormalesTrabajadas += r.turnoId?.horasTrabajo || 0;
                c.horasNormalesTrabajadas += (r.turnoId?.colacionMinutos / 60) || 0;
            }
            c.minutosTardanzaTotal += r.minutosTardanza || 0;
            c.horasExtraDeclaradas += r.horasExtra || 0;
            c.horasExtraAprobadas  += r.horasExtraAprobadas || 0;
        });

        // Calcular días trabajados para nómina considerando proporcionalidad de contratación/despacho
        const resumen = Object.values(porCandidato).map(c => {
            let diasBasePeriodo = 30; // Estándar mensual

            // Si el trabajador entró o salió en este periodo, ajustamos la base
            // (Misma lógica que la calculadora de nómina para consistencia total)
            const first = new Date(Date.UTC(y, m - 1, 1));
            const last  = new Date(Date.UTC(y, m, 0, 23, 59, 59));

            const cStart = c.datosCandidato?.contractStartDate ? new Date(c.datosCandidato.contractStartDate) : null;
            const cEnd   = (c.datosCandidato?.contractEndDate || c.datosCandidato?.fechaFiniquito) ? new Date(c.datosCandidato.contractEndDate || c.datosCandidato.fechaFiniquito) : null;

            // Ajuste Inicio
            if (cStart && cStart > first && cStart <= last) {
                const startDay = cStart.getDate();
                diasBasePeriodo = Math.max(0, 30 - startDay + 1);
            }

            // Ajuste Término
            if (cEnd && cEnd >= first && cEnd < last) {
                const endDay = cEnd.getDate();
                if (cStart && cStart > first) {
                    const startDay = cStart.getDate();
                    diasBasePeriodo = Math.max(0, endDay - startDay + 1);
                } else {
                    diasBasePeriodo = Math.min(diasBasePeriodo, endDay);
                }
            }

            // Cálculo: días trabajados = días computable - ausencias (excluye NC, feriado, domingo)
            const diasComputable = diasBasePeriodo - c.diasNC - c.diasFeriado - c.diasDomingo;
            const diasTrabajadosCalculados = Math.max(0, diasComputable - c.diasAusente - c.diasLicencia);

            return {
                ...c,
                diasTrabajados: diasTrabajadosCalculados,
                diasBasePeriodo,
                diasComputable,
                diasEfectivos: c.diasPresente + c.diasTardanza,
                calificaBono:  c.diasAusente === 0 && c.diasTardanza === 0,
            };
        });

        res.json(resumen);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Helper para calcular Horas Extras basado en el Turno
const calcularHorasExtra = async (turnoId, horaSalidaStr) => {
    if (!turnoId || !horaSalidaStr) return 0;
    try {
        const turno = await Turno.findById(turnoId);
        if (!turno || !turno.horasExtraPolicy?.habilitado) return 0;

        const [salidaHTurno, salidaMTurno] = turno.horaSalida.split(':').map(Number);
        const [salidaHReal, salidaMReal] = horaSalidaStr.split(':').map(Number);

        const minTurno = salidaHTurno * 60 + salidaMTurno;
        const minReal = salidaHReal * 60 + salidaMReal;

        const diffMin = minReal - minTurno;
        if (diffMin > 0) {
            let extras = diffMin / 60;
            if (extras > (turno.horasExtraPolicy.maxDiarias || 2)) {
                extras = turno.horasExtraPolicy.maxDiarias || 2;
            }
            return Math.round(extras * 100) / 100;
        }
    } catch (e) {
        console.error("Error calculando HE:", e);
    }
    return 0;
};

// ─── POST /asistencia ─ Crear o actualizar registro individual (upsert) ───────
// Usa upsert para evitar E11000 cuando ya existe un registro para ese candidato/fecha.
// Si existe → actualiza. Si no → crea. Retorna el documento poblado en ambos casos.
router.post('/', protect, authorize('rrhh_asistencia:crear', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR), async (req, res) => {
    try {
        const { candidatoId, fecha, ...rest } = req.body;
        if (!candidatoId || !fecha) {
            return res.status(400).json({ message: 'candidatoId y fecha son requeridos' });
        }

        // Normalizar fecha a medianoche UTC para que el índice único siempre coincida
        const fechaDate = new Date(fecha);
        fechaDate.setUTCHours(0, 0, 0, 0);

        const filter = {
            empresaRef:  req.user.empresaRef,
            candidatoId,
            fecha: fechaDate,
        };

        // Obtener el registro existente si lo hay para calcular horas extras con turno
        const existente = await RegistroAsistencia.findOne(filter);
        if (existente?.estadoRegistro === 'ANULADO') {
            return res.status(409).json({ message: 'El registro está anulado. Debe rehabilitarse por flujo legal antes de modificar.' });
        }
        const currentTurnoId = rest.turnoId || (existente && existente.turnoId);

        if (rest.horaSalida && currentTurnoId && rest.horasExtra === undefined) {
            const extras = await calcularHorasExtra(currentTurnoId, rest.horaSalida);
            if (extras > 0) {
                rest.horasExtra = extras;
                rest.estadoHorasExtra = 'Pendiente';
            }
        }

        const legalPatch = {
            ...rest,
            candidatoId,
            fecha: fechaDate,
            empresaRef: req.user.empresaRef,
            estadoRegistro: 'ACTIVO'
        };

        const evento = buildAuditEvent({
            registroActual: existente,
            patch: legalPatch,
            req,
            tipo: existente ? 'Actualización Operativa' : 'Creación Operativa',
            observacion: rest.observacion || 'Registro/actualización operativa'
        });

        const update = {
            $set: legalPatch,
            $push: { eventosTimeline: evento }
        };

        // Si es un marcaje manual o desde el portal, inyectar datos de auditoría
        if (req.body.horaIngresoDeclarada || req.body.horaSalida) {
            update.$set.auditLog = {
                ...(rest.auditLog || {}),
                ...baseAuditLog(req, (rest.auditLog && rest.auditLog.metodo) ? rest.auditLog.metodo : 'Web'),
                ultimoEventoHash: evento.hashActual
            };
        } else {
            update.$set.auditLog = {
                ...(existente?.auditLog || {}),
                ...baseAuditLog(req, 'Web'),
                ultimoEventoHash: evento.hashActual
            };
        }

        const saved = await RegistroAsistencia.findOneAndUpdate(filter, update, {
            new:    true,
            upsert: true,
            setDefaultsOnInsert: true,
            // runValidators omitido: causa errores con tipoAusencia: null en $set (Mongoose enum + runValidators)
        })
            .populate('candidatoId', 'fullName rut position cargo projectName projectId status email')
            .populate('turnoId', 'nombre horaEntrada horaSalida color diasSemana horariosPorDia');

        if (saved && saved.candidatoId && saved.candidatoId.email) {
            // No await to avoid blocking the response
            sendAttendanceNotificationEmail(saved, saved.candidatoId.email, req.user.empresaRef, req.user.nombre || req.user.email, 'REGISTRO').catch(console.error);
        }

        res.status(201).json(saved);
    } catch (err) {
        console.error('POST /asistencia error:', err.message);
        res.status(400).json({ message: err.message });
    }
});

// ─── POST /asistencia/bulk ─ Inserción masiva ─────────────────────────────────
router.post('/bulk', protect, authorize('rrhh_asistencia:crear', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        const { registros } = req.body;
        const con = registros.map(r => ({
            ...r,
            empresaRef: req.user.empresaRef,
            estadoRegistro: 'ACTIVO',
            auditLog: {
                ...(r.auditLog || {}),
                ...baseAuditLog(req, r.auditLog?.metodo || 'Web')
            }
        }));
        const result = await RegistroAsistencia.insertMany(con, { ordered: false });
        res.status(201).json({ insertados: result.length });
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─── POST /asistencia/bulk-upsert ─ Inserción/actualización masiva (sin duplicar) ─
router.post('/bulk-upsert', protect, authorize('rrhh_asistencia:editar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR, ROLES.JEFATURA), async (req, res) => {
    try {
        const { registros, onlyInsertNew } = req.body;
        const ops = registros.map(r => {
            // Normalizar fecha a medianoche UTC — consistente con el índice único
            const fechaDate = new Date(r.fecha);
            fechaDate.setUTCHours(0, 0, 0, 0);
            const updateDoc = {
                ...r,
                fecha: fechaDate,
                empresaRef: req.user.empresaRef,
                estadoRegistro: 'ACTIVO',
                auditLog: {
                    ...(r.auditLog || {}),
                    ...baseAuditLog(req, r.auditLog?.metodo || 'Web')
                }
            };
            return {
                updateOne: {
                    filter: {
                        empresaRef:  req.user.empresaRef,
                        candidatoId: r.candidatoId,
                        fecha:       fechaDate,          // exacto, no rango — el índice es por fecha UTC
                    },
                    update: onlyInsertNew ? { $setOnInsert: updateDoc } : { $set: updateDoc },
                    upsert: true,
                }
            };
        });
        const result = await RegistroAsistencia.bulkWrite(ops);

        // Fetch to send emails in background
        RegistroAsistencia.find({
            empresaRef: req.user.empresaRef,
            candidatoId: { $in: registros.map(r => r.candidatoId) },
            fecha: { $in: ops.map(o => o.updateOne.filter.fecha) }
        }).populate('candidatoId', 'email fullName').then(updatedDocs => {
            for (const doc of updatedDocs) {
                if (doc.candidatoId && doc.candidatoId.email) {
                    sendAttendanceNotificationEmail(doc, doc.candidatoId.email, req.user.empresaRef, req.user.nombre || req.user.email, 'REGISTRO').catch(console.error);
                }
            }
        }).catch(console.error);

        res.json({ upserted: result.upsertedCount, modified: result.modifiedCount });
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─── POST /asistencia/upload-respaldo ─ Subir respaldo fotográfico ────────────
router.post('/upload-respaldo', protect, authorize('rrhh_asistencia:editar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR), upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo' });
    }

    const cld_upload_stream = cloudinary.uploader.upload_stream(
        { folder: 'asistencia-respaldos' },
        (error, result) => {
            if (error) {
                console.error("Cloudinary error:", error);
                return res.status(500).json({ message: 'Error subiendo imagen a Cloudinary', error });
            }
            res.status(200).json({ url: result.secure_url });
        }
    );

    streamifier.createReadStream(req.file.buffer).pipe(cld_upload_stream);
});

// ─── PUT /asistencia/:id ─ Actualizar registro ────────────────────────────────
router.put('/:id', protect, authorize('rrhh_asistencia:editar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR), async (req, res) => {
    try {
        const existente = await RegistroAsistencia.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!existente) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        if (existente.estadoRegistro === 'ANULADO') {
            return res.status(409).json({ message: 'No se puede editar un registro anulado.' });
        }

        const currentTurnoId = req.body.turnoId || existente.turnoId;
        
        if (req.body.horaSalida && currentTurnoId && req.body.horasExtra === undefined) {
            const extras = await calcularHorasExtra(currentTurnoId, req.body.horaSalida);
            if (extras > 0) {
                req.body.horasExtra = extras;
                req.body.estadoHorasExtra = 'Pendiente';
            }
        }

        const legalPatch = { ...req.body };
        const evento = buildAuditEvent({
            registroActual: existente,
            patch: legalPatch,
            req,
            tipo: 'Actualización Legal',
            observacion: req.body.observacion || 'Actualización directa de registro'
        });

        const updated = await RegistroAsistencia.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            {
                $set: {
                    ...legalPatch,
                    auditLog: {
                        ...(existente.auditLog || {}),
                        ...baseAuditLog(req, existente.auditLog?.metodo || 'Web'),
                        ultimoEventoHash: evento.hashActual
                    }
                },
                $push: { eventosTimeline: evento }
            },
            { new: true }
        ).populate('candidatoId', 'fullName rut position')
         .populate('turnoId', 'nombre horaEntrada horaSalida color diasSemana horariosPorDia');
         
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── POST /asistencia/marcaje-legal ─ Crear Marcaje manual auditado (Admin) ──────────────
router.post('/marcaje-legal', protect, authorize('rrhh_asistencia:crear', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        console.log("POST /marcaje-legal req.body:", req.body);
        const { candidatoId, candidatosId, fecha, estado, horaEntrada, horaSalida, observacionLegal, turnoId } = req.body;
        
        let ids = [];
        let parsedCandidatos = candidatosId;
        if (typeof candidatosId === 'string') {
            try { parsedCandidatos = JSON.parse(candidatosId); } catch(e){}
        }

        if (parsedCandidatos && Array.isArray(parsedCandidatos) && parsedCandidatos.length > 0) {
            ids = parsedCandidatos;
        } else if (candidatoId) {
            ids = [candidatoId];
        }

        if (ids.length === 0 || !fecha) {
            console.log("Error: Candidato(s) y fecha obligatorios. ids:", ids, "fecha:", fecha);
            return res.status(400).json({ message: 'Candidato(s) y fecha son obligatorios' });
        }
        if (!observacionLegal) {
            return res.status(400).json({ message: 'La observación es obligatoria para marcajes manuales (Ord. 1140/27).' });
        }

        const fechaDate = new Date(fecha);
        fechaDate.setUTCHours(0, 0, 0, 0);

        let horasExtra = 0;
        let estadoHorasExtra = 'No Aplica';

        if (horaSalida && turnoId) {
            const extras = await calcularHorasExtra(turnoId, horaSalida);
            if (extras > 0) {
                horasExtra = extras;
                estadoHorasExtra = 'Pendiente';
            }
        }

        const auditLog = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            timestamp: new Date(),
            metodo: 'Web',
            nota: 'Marcaje Manual Administrativo Retroactivo'
        };

        const eventoLineaTiempo = {
            tipo: 'Marcaje Manual (Ord. 1140/27)',
            hora: horaEntrada || horaSalida || new Date().toISOString().substring(11, 16),
            estadoSeleccionado: estado,
            observacion: observacionLegal,
            registradoPor: req.user.nombre || req.user.email,
            timestamp: new Date()
        };

        const updateData = {
            estado,
            horaEntrada,
            horaIngresoDeclarada: horaEntrada,
            horaSalida,
            horasExtra,
            estadoHorasExtra,
            observacion: observacionLegal,
            auditLog,
            turnoId
        };

        const updatedRecords = [];

        for (const id of ids) {
            const filter = {
                empresaRef: req.user.empresaRef,
                candidatoId: id,
                fecha: fechaDate,
            };

            const existente = await RegistroAsistencia.findOne(filter);
            if (existente?.estadoRegistro === 'ANULADO') {
                continue;
            }

            const eventoLineaTiempo = buildAuditEvent({
                registroActual: existente,
                patch: updateData,
                req,
                tipo: 'Marcaje Manual (Ord. 1140/27)',
                observacion: observacionLegal
            });

            const updated = await RegistroAsistencia.findOneAndUpdate(
                filter,
                { 
                    $set: {
                        ...updateData,
                        estadoRegistro: 'ACTIVO',
                        auditLog: {
                            ...auditLog,
                            ultimoEventoHash: eventoLineaTiempo.hashActual
                        }
                    },
                    $push: { eventosTimeline: eventoLineaTiempo }
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            ).populate('candidatoId', 'fullName rut position email')
             .populate('turnoId', 'nombre horaEntrada horaSalida color diasSemana horariosPorDia');

            if (updated) {
                updatedRecords.push(updated);
                if (updated.candidatoId && updated.candidatoId.email) {
                    sendAttendanceNotificationEmail(updated, updated.candidatoId.email, req.user.empresaRef, req.user.nombre || req.user.email, 'REGISTRO_MANUAL').catch(console.error);
                }
            }
        }
         
        // Devolvemos el array entero si fueron multiples, si no, el primero (por retrocompatibilidad si es necesario)
        if (updatedRecords.length === 1 && !candidatosId) {
            res.json(updatedRecords[0]);
        } else {
            res.json(updatedRecords);
        }
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── PUT /asistencia/:id/marcaje-legal ─ Marcaje manual auditado (Admin) ──────────────
router.put('/:id/marcaje-legal', protect, authorize('rrhh_asistencia:editar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        const existente = await RegistroAsistencia.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!existente) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        if (existente.estadoRegistro === 'ANULADO') {
            return res.status(409).json({ message: 'No se puede editar un registro anulado.' });
        }

        const { estado, horaEntrada, horaSalida, observacionLegal } = req.body;
        
        if (!observacionLegal) {
            return res.status(400).json({ message: 'La observación es obligatoria para marcajes manuales (Ord. 1140/27).' });
        }

        // Determinar horas extra si corresponde
        let horasExtra = existente.horasExtra;
        let estadoHorasExtra = existente.estadoHorasExtra;
        const currentTurnoId = req.body.turnoId || existente.turnoId;

        if (horaSalida && currentTurnoId) {
            const extras = await calcularHorasExtra(currentTurnoId, horaSalida);
            if (extras > 0) {
                horasExtra = extras;
                estadoHorasExtra = 'Pendiente';
            }
        }

        const auditLog = {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            timestamp: new Date(),
            metodo: 'Web'
        };

        const eventoLineaTiempo = buildAuditEvent({
            registroActual: existente,
            patch: {
                estado,
                horaEntrada,
                horaIngresoDeclarada: horaEntrada,
                horaSalida,
                horasExtra,
                estadoHorasExtra,
                observacion: observacionLegal
            },
            req,
            tipo: 'Marcaje Manual (Ord. 1140/27)',
            observacion: observacionLegal
        });

        const updateData = {
            estado,
            horaEntrada,
            horaIngresoDeclarada: horaEntrada, // Sincronizar para consistencia con operativo
            horaSalida,
            horasExtra,
            estadoHorasExtra,
            observacion: observacionLegal,
            auditLog: {
                ...auditLog,
                ultimoEventoHash: eventoLineaTiempo.hashActual
            }
        };

        const updated = await RegistroAsistencia.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { 
                $set: updateData,
                $push: { eventosTimeline: eventoLineaTiempo }
            },
            { new: true }
        ).populate('candidatoId', 'fullName rut position email')
         .populate('turnoId', 'nombre horaEntrada horaSalida color diasSemana horariosPorDia');

        if (updated && updated.candidatoId && updated.candidatoId.email) {
            sendAttendanceNotificationEmail(updated, updated.candidatoId.email, req.user.empresaRef, req.user.nombre || req.user.email, 'MODIFICACION').catch(console.error);
        }
         
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── DELETE /asistencia/:id ────────────────────────────────────────────────────
router.delete('/:id', protect, authorize('rrhh_asistencia:eliminar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        const { motivo } = req.body || {};
        const existente = await RegistroAsistencia.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!existente) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        if (existente.estadoRegistro === 'ANULADO') {
            return res.status(409).json({ message: 'El registro ya está anulado.' });
        }

        const evento = buildAuditEvent({
            registroActual: existente,
            patch: { estadoRegistro: 'ANULADO' },
            req,
            tipo: 'Anulación Legal',
            observacion: motivo || 'Anulación administrativa con trazabilidad legal'
        });

        const result = await RegistroAsistencia.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            {
                $set: {
                    estadoRegistro: 'ANULADO',
                    anulado: {
                        byUserId: req.user._id,
                        by: req.user.nombre || req.user.email,
                        motivo: motivo || 'Anulación administrativa con trazabilidad legal',
                        timestamp: new Date()
                    },
                    auditLog: {
                        ...(existente.auditLog || {}),
                        ...baseAuditLog(req, existente.auditLog?.metodo || 'Web'),
                        ultimoEventoHash: evento.hashActual
                    }
                },
                $push: { eventosTimeline: evento }
            },
            { new: true }
        );

        res.json({ message: 'Registro anulado (sin borrado físico)', registro: result });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── POST /asistencia/sync-toa ─ Auto-sync attendance based on TOA production ───
router.post('/sync-toa', protect, authorize('rrhh_asistencia:editar', ROLES.ADMIN, ROLES.CEO, ROLES.RRHH), async (req, res) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);
        
        // 1. Definir rango del mes (UTC)
        const firstDay = new Date(Date.UTC(y, m - 1, 1));
        const lastDay = new Date(Date.UTC(y, m, 0, 23, 59, 59));
        
        // 2. Traer Candidatos
        const Candidato = require('../models/Candidato');
        const candidatos = await Candidato.find({ 
            empresaRef: req.user.empresaRef,
            status: 'Contratado',
            $or: [
                { position: { $regex: /TECNICO/i } },
                { cargo: { $regex: /TECNICO/i } }
            ]
        });

        // 3. Traer Actividades (Producción TOA)
        const Actividad = require('../../agentetelecom/models/Actividad');
        const actividades = await Actividad.find({
            empresaRef: req.user.empresaRef,
            fecha: { $gte: firstDay, $lte: lastDay }
        }).populate('tecnicoId');

        const cleanRut = (r) => (r || "").toString().replace(/[^0-9kK]/g, '').toUpperCase().trim();

        // 4. Mapear días con producción por RUT
        const prodPorRutYDia = {};
        actividades.forEach(a => {
            // Soporta que el RUT venga del tecnico poblado, o directamente en la actividad
            const rutRaw = (a.tecnicoId && a.tecnicoId.rut) ? a.tecnicoId.rut : (a.rut || a.ID_del_recurso || '');
            const rut = cleanRut(rutRaw);
            if (!rut) return;

            const d = new Date(a.fecha);
            // Evitar inválidas
            if (isNaN(d.getTime())) return;

            const dayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            
            if (!prodPorRutYDia[rut]) prodPorRutYDia[rut] = new Set();
            prodPorRutYDia[rut].add(dayStr);
        });

        // 5. Traer Feriados (Opcional: podrías usar una lista estática o base de datos)
        const feriadosSet = new Set([
            '2025-01-01','2025-04-18','2025-04-19','2025-05-01','2025-05-21',
            '2025-06-29','2025-07-16','2025-08-15','2025-09-18','2025-09-19',
            '2025-10-31','2025-11-01','2025-12-08','2025-12-25',
            '2026-01-01','2026-04-03','2026-04-04','2026-05-01','2026-05-21',
            '2026-06-29','2026-07-16','2026-08-15','2026-09-18','2026-09-19',
            '2026-10-12','2026-10-31','2026-11-01','2026-12-08','2026-12-25',
        ]);

        // 6. Traer Registros de Asistencia Existentes
        const registrosExistentes = await RegistroAsistencia.find({
            empresaRef: req.user.empresaRef,
            fecha: { $gte: firstDay, $lte: lastDay }
        });

        const mapExistentes = {};
        registrosExistentes.forEach(r => {
            const cId = r.candidatoId.toString();
            const d = new Date(r.fecha);
            const dayStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            if (!mapExistentes[cId]) mapExistentes[cId] = {};
            mapExistentes[cId][dayStr] = r;
        });

        const operaciones = [];

        // 7. Generar Asistencia para cada Candidato
        candidatos.forEach(c => {
            const rut = cleanRut(c.rut);
            const cId = c._id.toString();
            const dtInicio = c.contractStartDate ? new Date(c.contractStartDate) : null;
            if (dtInicio) dtInicio.setUTCHours(0,0,0,0);
            
            // Recorrer los días del mes (solo hasta hoy)
            const hoy = new Date();
            const maxDia = (y === hoy.getFullYear() && m === (hoy.getMonth() + 1)) ? hoy.getDate() : lastDay.getUTCDate();

            for (let dia = 1; dia <= maxDia; dia++) {
                const dateUTC = new Date(Date.UTC(y, m - 1, dia));
                const dayStr = `${dateUTC.getUTCFullYear()}-${String(dateUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(dateUTC.getUTCDate()).padStart(2, '0')}`;
                
                // Si el día es anterior al inicio de contrato, no generar registro (o marcar como NC si se prefiere persistir)
                if (dtInicio && dateUTC < dtInicio) continue;

                const dayOfWeek = dateUTC.getUTCDay(); // 0 = Domingo
                const isDomingo = dayOfWeek === 0;
                const isFeriado = feriadosSet.has(dayStr);
                
                const produjo = prodPorRutYDia[rut] && prodPorRutYDia[rut].has(dayStr);
                
                // Verificar si ya hay registro manual importante
                const existente = mapExistentes[cId] && mapExistentes[cId][dayStr];
                if (existente && ['Licencia', 'Vacaciones', 'Permiso'].includes(existente.estado)) {
                    continue; // Respetar estado manual médico/administrativo
                }

                let nuevoEstado = '';
                let descuenta = false;

                if (produjo) {
                    nuevoEstado = 'Presente';
                    descuenta = false;
                } else {
                    if (isDomingo) {
                        nuevoEstado = 'Libre';
                        descuenta = false;
                    } else if (isFeriado) {
                        nuevoEstado = 'Feriado';
                        descuenta = false;
                    } else {
                        nuevoEstado = 'Ausente';
                        descuenta = true;
                    }
                }

                // Upsert
                operaciones.push({
                    updateOne: {
                        filter: {
                            empresaRef: req.user.empresaRef,
                            candidatoId: c._id,
                            fecha: dateUTC,
                            estadoRegistro: { $ne: 'ANULADO' }
                        },
                        update: {
                            $set: {
                                candidatoId: c._id,
                                empresaRef: req.user.empresaRef,
                                fecha: dateUTC,
                                estado: nuevoEstado,
                                descuentaDia: descuenta,
                                automaticoTOA: true,
                                estadoRegistro: 'ACTIVO'
                            }
                        },
                        upsert: true
                    }
                });
            }
        });

        let upserted = 0, modified = 0;
        if (operaciones.length > 0) {
            const result = await RegistroAsistencia.bulkWrite(operaciones);
            upserted = result.upsertedCount;
            modified = result.modifiedCount;
        }

        res.json({ success: true, upserted, modified, mensaje: `Sincronización completa: ${upserted + modified} días procesados vinculando producción TOA.` });
    } catch (err) {
        console.error('Error en sync-toa:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /asistencia/sync-from-produccion ─ Sincronización mejorada con finiquitos y cliente ───────
// FASE 4: Mejorada para:
// 1. Mapeo fallback Candidato↔Tecnico: idRecursoToa → RUT → nombre fuzzy
// 2. Filtrar finiquitados: excluir si contractEndDate < mes actual
// 3. Marcar FIN: si contractEndDate está en mes actual
// 4. Enriquecer con datos de cliente y proyecto
// 5. Reglas de estado:
//    - NC: antes de contractStartDate
//    - Finiquitado: después de contractEndDate (si está en mes actual)
//    - Feriado/Libre: según calendario
//    - Presente/Ausente: según producción
router.post('/sync-from-produccion', protect, authorize('rrhh_asistencia:editar', ROLES.ADMIN, ROLES.CEO, ROLES.RRHH), async (req, res) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);
        const firstDay = new Date(Date.UTC(y, m - 1, 1));
        const lastDay = new Date(Date.UTC(y, m, 0, 23, 59, 59));

        // 1. Obtener días del mes
        const diasMes = feriadosUtil.getDiasDelMes(y, m);

        // 2. FILTRO CRÍTICO: Candidatos NO finiquitados antes de este mes
        const candidatos = await Candidato.find({
            empresaRef: req.user.empresaRef,
            $or: [
                { contractEndDate: { $exists: false } },
                { contractEndDate: { $gt: firstDay } }  // Excluir finiquitados en mes anterior
            ]
        }).populate('projectId', 'cliente nombreProyecto').lean();

        // 3. Obtener Técnicos para mapeos fallback
        const tecnicos = await Tecnico.find({
            empresaRef: req.user.empresaRef,
        }).lean();

        // MAPEOS FALLBACK: idRecursoToa → RUT → nombre fuzzy
        const tecnicosPorIdToa = {};
        const tecnicosPorRut = {};
        const cleanRut = (r) => (r || '').replace(/[^0-9kK]/g, '').toUpperCase();

        tecnicos.forEach(t => {
            if (t.idRecursoToa) tecnicosPorIdToa[t.idRecursoToa] = t;
            if (t.rut) tecnicosPorRut[cleanRut(t.rut)] = t;
        });

        // 4. Obtener Actividades (producción)
        const actividades = await Actividad.find({
            empresaRef: req.user.empresaRef,
            fecha: { $gte: firstDay, $lte: lastDay }
        }).lean();

        // Mapeo: { fechaStr: { idRecursoToa: totalPuntos } }
        const prodPorFecha = {};
        actividades.forEach(a => {
            const dateStr = feriadosUtil.toDateString(new Date(a.fecha));
            if (!prodPorFecha[dateStr]) prodPorFecha[dateStr] = {};
            const pts = parseFloat(a.Pts_Total_Baremo) || parseFloat(a.puntos) || 0;
            if (pts > 0) {
                if (!prodPorFecha[dateStr][a.Recurso]) prodPorFecha[dateStr][a.Recurso] = 0;
                prodPorFecha[dateStr][a.Recurso] += pts;
            }
        });

        // 5. Generar operaciones con lógica mejorada
        const operaciones = [];
        let candidatosProcessados = 0;

        for (const candidato of candidatos) {
            const cId = candidato._id;
            const contractStart = candidato.contractStartDate ? new Date(candidato.contractStartDate) : null;
            const contractEnd = candidato.contractEndDate ? new Date(candidato.contractEndDate) : candidato.fechaFiniquito ? new Date(candidato.fechaFiniquito) : null;

            // MAPEO FALLBACK CANDIDATO → TECNICO
            let tecnicoAsociado = null;
            const idsProduccion = [];

            // Primario: idRecursoToa del candidato
            if (candidato.idRecursoToa) {
                tecnicoAsociado = tecnicosPorIdToa[candidato.idRecursoToa];
                idsProduccion.push(candidato.idRecursoToa);
            }

            // Secundario: RUT (si no encontrado)
            if (!tecnicoAsociado && candidato.rut) {
                tecnicoAsociado = tecnicosPorRut[cleanRut(candidato.rut)];
            }

            // Terciario: nombre fuzzy (último recurso)
            if (!tecnicoAsociado && candidato.fullName && tecnicos.length > 0) {
                tecnicoAsociado = tecnicos.find(t => t.nombre && candidato.fullName.includes(t.nombre));
            }

            // Agregar idRecursoToa del técnico encontrado
            if (tecnicoAsociado && tecnicoAsociado.idRecursoToa) {
                idsProduccion.push(tecnicoAsociado.idRecursoToa);
            }

            // Enriquecer con datos de cliente/proyecto
            const proyecto = candidato.projectId || {};
            const cliente = proyecto.cliente || {};
            const clienteNombre = cliente.nombre || '—';
            const proyectoNombre = proyecto.nombreProyecto || candidato.projectName || '—';

            // Procesar cada día del mes
            for (const dia of diasMes) {
                const fechaStr = dia.fecha;
                const fechaDate = new Date(fechaStr + 'T12:00:00Z');

                let estado = 'Presente';
                let descuenta = false;
                let isBeforeContract = false;
                let esFeriado = false;
                let esDomingo = false;
                let finiquitado = false;
                let fechaFiniquito = null;

                // LÓGICA DE ESTADO (orden de evaluación es crítico)
                // 1. NC: ANTES de contractStartDate
                if (contractStart && fechaDate < contractStart) {
                    estado = 'NC';
                    isBeforeContract = true;
                }
                // 2. FINIQUITADO: DESPUÉS de contractEndDate (si está en mes actual)
                else if (contractEnd && fechaDate >= contractEnd) {
                    estado = 'Finiquitado';
                    finiquitado = true;
                    fechaFiniquito = contractEnd;
                    descuenta = false;
                }
                // 3. FERIADO
                else if (dia.esFeriado) {
                    estado = 'Feriado';
                    esFeriado = true;
                }
                // 4. DOMINGO/LIBRE
                else if (dia.esDomingo) {
                    estado = 'Libre';
                    esDomingo = true;
                }
                // 5. PRODUCCIÓN (si está contratado y no es feriado/domingo)
                else {
                    let tieneProd = false;
                    for (const idProd of idsProduccion) {
                        if (prodPorFecha[fechaStr] && prodPorFecha[fechaStr][idProd] > 0) {
                            tieneProd = true;
                            break;
                        }
                    }

                    if (tieneProd) {
                        estado = 'Presente';
                        descuenta = false;
                    } else {
                        estado = 'Ausente';
                        descuenta = true;
                    }
                }

                // Crear operación de upsert
                operaciones.push({
                    updateOne: {
                        filter: {
                            empresaRef: req.user.empresaRef,
                            candidatoId: cId,
                            fecha: fechaDate,
                            estadoRegistro: { $ne: 'ANULADO' }
                        },
                        update: {
                            $set: {
                                candidatoId: cId,
                                empresaRef: req.user.empresaRef,
                                fecha: fechaDate,
                                estado,
                                descuentaDia: descuenta,
                                isBeforeContract,
                                esFeriado,
                                esDomingo,
                                finiquitado,
                                fechaFiniquito,
                                clienteId: cliente._id,
                                clienteNombre,
                                proyectoId: proyecto._id,
                                proyectoNombre,
                                syncFromProduccion: true,
                                estadoRegistro: 'ACTIVO'
                            }
                        },
                        upsert: true
                    }
                });
            }
            candidatosProcessados++;
        }

        // 6. Ejecutar bulkWrite
        let upserted = 0, modified = 0;
        if (operaciones.length > 0) {
            const result = await RegistroAsistencia.bulkWrite(operaciones);
            upserted = result.upsertedCount || 0;
            modified = result.modifiedCount || 0;
        }

        res.json({
            success: true,
            candidatosProcessados,
            upserted,
            modified,
            total: upserted + modified,
            mensaje: `✓ Sincronización FASE 4 (Finiquitos + Cliente + Fallback Técnicos): ${candidatosProcessados} candidatos, ${upserted + modified} registros procesados`
        });
    } catch (err) {
        console.error('Error en sync-from-produccion:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /asistencia/reporte-legal ─ Exportable para fiscalización y auditoría ─────────
router.get('/reporte-legal', protect, authorize('rrhh_asistencia:ver', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.AUDITOR), async (req, res) => {
    try {
        const { month, year, candidatoId, includeAnulados } = req.query;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);
        const filter = {
            empresaRef: req.user.empresaRef,
            fecha: {
                $gte: new Date(Date.UTC(y, m - 1, 1)),
                $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59)),
            }
        };
        if (candidatoId) filter.candidatoId = candidatoId;
        if (String(includeAnulados) !== 'true') {
            filter.estadoRegistro = { $ne: 'ANULADO' };
        }

        const registros = await RegistroAsistencia.find(filter)
            .populate('candidatoId', 'fullName rut position cargo')
            .populate('turnoId', 'nombre horaEntrada horaSalida')
            .sort({ fecha: 1, 'candidatoId.fullName': 1 })
            .lean();

        const filas = registros.map((r) => {
            const verificacion = verifyRegistroIntegrity(r);
            return {
                id: r._id,
                fecha: r.fecha,
                trabajador: r.candidatoId?.fullName || '—',
                rut: r.candidatoId?.rut || '—',
                cargo: r.candidatoId?.position || r.candidatoId?.cargo || '—',
                estado: r.estado,
                horaEntrada: r.horaIngresoDeclarada || r.horaEntrada || '—',
                horaSalida: r.horaSalida || '—',
                turno: r.turnoId?.nombre || '—',
                estadoRegistro: r.estadoRegistro || 'ACTIVO',
                hashIntegridad: r.auditLog?.ultimoEventoHash || null,
                eventosAuditados: verificacion.totalEventos,
                integridadOk: verificacion.ok,
                inconsistenciasIntegridad: verificacion.inconsistencias
            };
        });

        const resumen = {
            totalRegistros: filas.length,
            totalAnulados: filas.filter((f) => f.estadoRegistro === 'ANULADO').length,
            totalConIntegridadOk: filas.filter((f) => f.integridadOk).length,
            totalConFallaIntegridad: filas.filter((f) => !f.integridadOk).length,
            generadoEn: new Date().toISOString(),
            generadoPor: req.user.nombre || req.user.email
        };

        res.json({ resumen, filas });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /asistencia/:id/verificar-integridad ─ Diagnóstico criptográfico ───────────────
router.get('/:id/verificar-integridad', protect, authorize('rrhh_asistencia:ver', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.AUDITOR), async (req, res) => {
    try {
        const registro = await RegistroAsistencia.findOne({
            _id: req.params.id,
            empresaRef: req.user.empresaRef
        }).lean();

        if (!registro) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        const verificacion = verifyRegistroIntegrity(registro);
        res.json({
            registroId: registro._id,
            estadoRegistro: registro.estadoRegistro || 'ACTIVO',
            ...verificacion
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /asistencia/validar-contrato ─ Validar coherencia de contratos ─────────
// Verifica que todos los registros sean >= contractStartDate
router.post('/validar-contrato', protect, authorize('rrhh_asistencia:editar', ROLES.ADMIN, ROLES.CEO, ROLES.RRHH), async (req, res) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);
        const filter = {
            empresaRef: req.user.empresaRef,
            fecha: {
                $gte: new Date(Date.UTC(y, m - 1, 1)),
                $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59)),
            }
        };

        const registros = await RegistroAsistencia.find(filter)
            .populate('candidatoId', 'fullName rut contractStartDate contractEndDate')
            .lean();

        const anomalias = [];
        const resumenPorCandidato = {};

        registros.forEach(r => {
            const cId = r.candidatoId?._id?.toString();
            if (!cId) return;

            if (!resumenPorCandidato[cId]) {
                resumenPorCandidato[cId] = {
                    candidato: r.candidatoId?.fullName,
                    rut: r.candidatoId?.rut,
                    contractStart: r.candidatoId?.contractStartDate,
                    registrosConflictivos: []
                };
            }

            // Validar contractStartDate
            if (r.candidatoId?.contractStartDate) {
                const regDate = new Date(r.fecha);
                const conDate = new Date(r.candidatoId.contractStartDate);
                regDate.setHours(0,0,0,0);
                conDate.setHours(0,0,0,0);

                if (regDate < conDate && !r.isBeforeContract) {
                    anomalias.push({
                        candidato: r.candidatoId.fullName,
                        rut: r.candidatoId.rut,
                        fecha: r.fecha,
                        problema: `Registro anterior a contractStartDate (${r.candidatoId.contractStartDate}) pero no marcado como NC`
                    });
                    resumenPorCandidato[cId].registrosConflictivos.push(r.fecha);
                }
            }
        });

        res.json({
            validacion: anomalias.length === 0 ? 'EXITOSA' : 'CON ANOMALÍAS',
            totalAnomalias: anomalias.length,
            anomalias,
            resumen: Object.values(resumenPorCandidato)
        });
    } catch (err) {
        console.error('Error en validar-contrato:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
