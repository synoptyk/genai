const express = require('express');
const router = express.Router();
const RegistroAsistencia = require('../models/RegistroAsistencia');
const Candidato = require('../models/Candidato');
const Tecnico = require('../../agentetelecom/models/Tecnico');
const Actividad = require('../../agentetelecom/models/Actividad');
const Turno = require('../models/Turno');
const ValidacionAsistencia = require('../models/ValidacionAsistencia');
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

router.get('/resumen-periodo', protect, authorize('rrhh_asistencia:ver', 'op_colaborador:ver', 'op_colaborador', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.TECNICO, ROLES.COLABORADOR), async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);
        const daysInMonth = new Date(y, m, 0).getDate();
        const today = new Date();

        const FERIADOS_CHILE = {
            '2026-00-01': 'Año Nuevo', '2026-03-03': 'Viernes Santo', '2026-03-04': 'Sábado Santo',
            '2026-04-01': 'Día del Trabajo', '2026-04-21': 'Día de las Glorias Navales',
            '2026-05-07': 'San Pedro y San Pablo', '2026-05-29': 'Día de los Pueblos Indígenas',
            '2026-06-16': 'Día de la Virgen del Carmen', '2026-07-15': 'Asunción de la Virgen',
            '2026-08-18': 'Fiestas Patrias', '2026-08-19': 'Día de las Glorias del Ejército',
            '2026-09-12': 'Encuentro de Dos Mundos', '2026-09-31': 'Día de las Iglesias Evangélicas',
            '2026-10-01': 'Día de Todos los Santos', '2026-11-08': 'Inmaculada Concepción',
            '2026-11-25': 'Navidad'
        };

        const isFeCheck = (yearVal, monthVal, dayVal) => {
            const mm = String(monthVal - 1).padStart(2, '0');
            const dd = String(dayVal).padStart(2, '0');
            return !!FERIADOS_CHILE[`${yearVal}-${mm}-${dd}`];
        };

        const MAPA_DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const normStr = str => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const minutesDiff = (e, s) => {
            if (!e || !s) return 0;
            const [eH, eM] = e.split(':').map(Number);
            const [sH, sM] = s.split(':').map(Number);
            let diff = (sH * 60 + sM) - (eH * 60 + eM);
            if (diff < 0) diff += 1440;
            return diff;
        };

        const getHorarioDia = (turno, diaNombre) => {
            if (!turno) return null;
            const override = (turno.horariosPorDia || []).find(h => normStr(h.dia) === normStr(diaNombre));
            return {
                horaEntrada: override?.horaEntrada ?? turno.horaEntrada ?? null,
                horaSalida: override?.horaSalida ?? turno.horaSalida ?? null,
                colacionMinutos: override?.colacionMinutos ?? turno.colacionMinutos ?? 60,
            };
        };

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

        const turnosList = await Turno.find({}).lean();
        const turnoByWorkerMap = {};
        turnosList.forEach(t => {
            const arr = t.colaboradoresAsignados || t.candidatosAsignados || t.colominoAsignados || [];
            arr.forEach(cid => {
                const idStr = cid?._id ? cid._id.toString() : cid?.toString();
                if (idStr) turnoByWorkerMap[idStr] = t;
            });
        });

        const allCandidatos = await Candidato.find({ 
            empresaRef: req.user.empresaRef, 
            status: { $ne: 'RECHAZADO' },
            rut: { $not: /INACTIVO/i }
        }).lean();
        const periodoKey = `${y}-${String(m).padStart(2, '0')}`;
        const validacionesList = await ValidacionAsistencia.find({ empresaRef: req.user.empresaRef, periodo: periodoKey }).lean();
        const validacionesMap = {};
        validacionesList.forEach(v => {
            if (v.candidatoId) validacionesMap[v.candidatoId.toString()] = v;
        });

        // Indexar registros por candidato y día (1..31)
        const regsByWorker = {};
        const candidatosMap = {};

        allCandidatos.forEach(c => {
            candidatosMap[c._id.toString()] = c;
        });

        registros.forEach(r => {
            const cId = r.candidatoId?._id?.toString() || r.candidatoId?.toString();
            if (cId && !candidatosMap[cId]) {
                candidatosMap[cId] = r.candidatoId;
            }
            if (cId) {
                if (!regsByWorker[cId]) regsByWorker[cId] = {};
                const day = new Date(r.fecha).getUTCDate();
                regsByWorker[cId][day] = r;
            }
        });

        const porCandidato = {};

        // Recorrer cada candidato y calcular los 31 días igual que en CalendarioAsistencia.jsx
        Object.keys(candidatosMap).forEach(cId => {
            const candInfo = candidatosMap[cId];
            const userRegs = regsByWorker[cId] || {};
            const turno = turnoByWorkerMap[cId] || turnosList[0];

            let totalTurnoMin = 0;
            let totalTrabajadoMin = 0;
            let totalExtraMin = 0;
            let totalNoTrabajadoMin = 0;
            let totalLibresMin = 0;
            let presentes = 0, ausentes = 0, tardanzas = 0, licencias = 0, permisos = 0, vacaciones = 0, feriados = 0, domingos = 0;

            for (let day = 1; day <= daysInMonth; day++) {
                const reg = userRegs[day];
                const date = new Date(y, m - 1, day);
                const diaNombre = MAPA_DIAS[date.getDay()];
                const esLaboral = turno ? (turno.diasSemana || []).map(normStr).includes(normStr(diaNombre)) : false;
                const esFe = isFeCheck(y, m, day);

                const estadoReal = reg?.estado || (esLaboral ? (date <= today ? 'Ausente' : 'default') : 'Libre');
                const esAusenciaJustificada = estadoReal === 'Libre' || estadoReal === 'Permiso';
                const isIgnorado = ['NC', 'Finiquitado', 'Licencia Médica', 'Vacaciones', 'Suspendido'].includes(estadoReal);

                switch (estadoReal) {
                    case 'Presente': presentes++; break;
                    case 'Tardanza': tardanzas++; break;
                    case 'Ausente': ausentes++; break;
                    case 'Licencia Médica':
                    case 'Licencia': licencias++; break;
                    case 'Permiso': permisos++; break;
                    case 'Vacaciones': vacaciones++; break;
                    case 'Feriado': feriados++; break;
                    case 'Libre': domingos++; break;
                }

                let expectedMin = 0;
                if (esLaboral && !esFe && turno && !isIgnorado) {
                    const h = getHorarioDia(turno, diaNombre);
                    if (h?.horaEntrada && h?.horaSalida) {
                        const reqMin = Math.max(0, minutesDiff(h.horaEntrada, h.horaSalida) - (h.colacionMinutos || 0));
                        expectedMin = reqMin;
                        totalTurnoMin += expectedMin;
                        if (esAusenciaJustificada) {
                            totalLibresMin += reqMin;
                        }
                    }
                }

                let workedMin = 0;
                if (reg && reg.horaEntrada && reg.horaSalida && estadoReal !== 'NC' && estadoReal !== 'Finiquitado') {
                    const h = getHorarioDia(turno, diaNombre);
                    const col = h?.colacionMinutos ?? 60;
                    workedMin = Math.max(0, minutesDiff(reg.horaEntrada, reg.horaSalida) - col);
                    totalTrabajadoMin += workedMin;
                }

                if (esLaboral && !esFe && expectedMin > 0 && date <= today) {
                    if (workedMin > expectedMin) {
                        totalExtraMin += (workedMin - expectedMin);
                    } else if (workedMin < expectedMin && estadoReal !== 'Licencia Médica' && estadoReal !== 'Vacaciones' && !esAusenciaJustificada) {
                        totalNoTrabajadoMin += (expectedMin - workedMin);
                    }
                } else if (!esLaboral || esFe || esAusenciaJustificada) {
                    if (workedMin > 0) totalExtraMin += workedMin;
                }
            }

            const hrsTurno = totalTurnoMin / 60;
            const hrsTrab = totalTrabajadoMin / 60;
            const hrsNoTrab = totalNoTrabajadoMin / 60;
            const hrsLibres = totalLibresMin / 60;
            const hrsExtras = totalExtraMin / 60;
            const balanceOriginal = hrsExtras - hrsNoTrab - hrsLibres;

            const valRecord = validacionesMap[cId] || null;
            let balanceFinal = balanceOriginal;
            if (valRecord) {
                if (valRecord.estadoValidacion === 'COMPENSADO_ZERO') {
                    balanceFinal = 0;
                } else if (valRecord.estadoValidacion === 'AJUSTE_MANUAL') {
                    balanceFinal = valRecord.balanceAprobadoFinal;
                } else if (valRecord.estadoValidacion === 'APROBADO_ORIGINAL') {
                    balanceFinal = balanceOriginal;
                }
            }

            const startOfMonth = new Date(y, m - 1, 1);
            const endOfMonth = new Date(y, m, 0);
            const ingresoDate = candInfo?.contractStartDate ? new Date(candInfo.contractStartDate) : null;
            const finiquitoDate = candInfo?.fechaFiniquito ? new Date(candInfo.fechaFiniquito) : null;
            
            let baseDiasMes = 30; // Norma legal chilena 30 días mes completo
            if (ingresoDate && !isNaN(ingresoDate.getTime())) {
                if (ingresoDate > endOfMonth) {
                    baseDiasMes = 0;
                } else if (ingresoDate > startOfMonth) {
                    const startDay = ingresoDate.getUTCDate();
                    let endDay = daysInMonth;
                    if (finiquitoDate && !isNaN(finiquitoDate.getTime()) && finiquitoDate <= endOfMonth) {
                        endDay = finiquitoDate.getUTCDate();
                    }
                    baseDiasMes = Math.min(30, Math.max(0, endDay - startDay + 1));
                }
            }
            if (finiquitoDate && !isNaN(finiquitoDate.getTime()) && finiquitoDate <= endOfMonth && (!ingresoDate || ingresoDate <= startOfMonth)) {
                baseDiasMes = Math.min(30, Math.max(0, finiquitoDate.getUTCDate()));
            }

            const diasInasistencia = ausentes;
            const diasPermisos = permisos + licencias + vacaciones;
            const diasAPago = Math.max(0, baseDiasMes - diasInasistencia);

            porCandidato[cId] = {
                candidatoId: cId,
                nombre: candInfo?.fullName || '—',
                rut: candInfo?.rut || '',
                cargo: candInfo?.position || candInfo?.cargo || '',
                contractStartDate: candInfo?.contractStartDate,
                datosCandidato: candInfo,
                diasPresente: presentes,
                diasTardanza: tardanzas,
                diasAusente: ausentes,
                diasInasistencia: ausentes,
                diasLicencia: licencias,
                diasPermiso: permisos,
                diasVacaciones: vacaciones,
                diasPermisos: permisos + licencias + vacaciones,
                diasFeriado: feriados,
                diasDomingo: domingos,
                diasEfectivos: presentes + tardanzas,
                diasBaseMes: baseDiasMes,
                diasAPago: diasAPago,
                horasTurnoTotales: Math.round(hrsTurno * 100) / 100,
                horasEfectivasTrabajadas: Math.round(hrsTrab * 100) / 100,
                horasNoTrabajadas: Math.round(hrsNoTrab * 100) / 100,
                horasLibres: Math.round(hrsLibres * 100) / 100,
                horasExtraAprobadas: Math.round(hrsExtras * 100) / 100,
                horasExtraDeclaradas: Math.round(hrsExtras * 100) / 100,
                balanceOriginal: Math.round(balanceOriginal * 100) / 100,
                balanceHoras: Math.round(balanceFinal * 100) / 100,
                calificaBono: ausentes === 0 && tardanzas === 0,
                validacion: valRecord ? {
                    _id: valRecord._id,
                    estadoValidacion: valRecord.estadoValidacion,
                    balanceAprobadoFinal: valRecord.balanceAprobadoFinal,
                    observacionSupervisor: valRecord.observacionSupervisor,
                    validadoPor: valRecord.validadoPor,
                    validadoPorEmail: valRecord.validadoPorEmail,
                    fechaValidacion: valRecord.fechaValidacion
                } : null
            };
        });

        const resumen = Object.values(porCandidato);

        res.json(resumen);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── POST /asistencia/validar-balance ─ Validación y Compensación de Horas ────
router.post('/validar-balance', protect, authorize('rrhh_asistencia:editar', ROLES.SYSTEM_ADMIN, ROLES.ADMIN, ROLES.RRHH, ROLES.GERENCIA, ROLES.CEO_GENAI, ROLES.CEO), async (req, res) => {
    try {
        const { candidatoId, periodo, estadoValidacion, balanceAprobadoFinal, observacionSupervisor, metricsSnapshot } = req.body;
        if (!candidatoId || !periodo || !estadoValidacion) {
            return res.status(400).json({ message: 'candidatoId, periodo y estadoValidacion son requeridos' });
        }

        const validacion = await ValidacionAsistencia.findOneAndUpdate(
            { empresaRef: req.user.empresaRef, periodo, candidatoId },
            {
                rut: metricsSnapshot?.rut,
                balanceOriginal: metricsSnapshot?.balanceOriginal || 0,
                horasTurnoTotales: metricsSnapshot?.horasTurnoTotales || 0,
                horasEfectivasTrabajadas: metricsSnapshot?.horasEfectivasTrabajadas || 0,
                horasNoTrabajadas: metricsSnapshot?.horasNoTrabajadas || 0,
                horasLibres: metricsSnapshot?.horasLibres || 0,
                horasExtraAprobadas: metricsSnapshot?.horasExtraAprobadas || 0,
                estadoValidacion,
                balanceAprobadoFinal: Number(balanceAprobadoFinal || 0),
                observacionSupervisor: observacionSupervisor || '',
                validadoPor: req.user.fullName || req.user.nombre || 'Supervisor RRHH',
                validadoPorEmail: req.user.email || '',
                fechaValidacion: new Date()
            },
            { upsert: true, new: true }
        );

        res.json({ ok: true, data: validacion });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
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
router.post('/sync-estados', protect, authorize('rrhh_asistencia:editar', ROLES.ADMIN, ROLES.CEO, ROLES.RRHH), async (req, res) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);
        const firstDay = new Date(Date.UTC(y, m - 1, 1));
        const lastDay = new Date(Date.UTC(y, m, 0, 23, 59, 59));

        // 1. Obtener días del mes
        const diasMes = feriadosUtil.getDiasDelMes(y, m);

        // 2. FILTRO CRÍTICO: Candidatos activos o finiquitados desde este mes en adelante
        const candidatos = await Candidato.find({
            empresaRef: req.user.empresaRef,
            $or: [
                { isActive: true },
                { contractEndDate: { $gte: firstDay } },
                { fechaFiniquito: { $gte: firstDay } }
            ]
        }).populate('projectId', 'cliente nombreProyecto').lean();

        // 3. Obtener Registros Existentes (para preservar marcas e hitos manuales)
        const registrosExistentes = await RegistroAsistencia.find({
            empresaRef: req.user.empresaRef,
            fecha: { $gte: firstDay, $lte: lastDay }
        }).lean();

        const regMap = {};
        registrosExistentes.forEach(r => {
             const dStr = feriadosUtil.toDateString(new Date(r.fecha));
             const cIdStr = r.candidatoId.toString();
             if (!regMap[cIdStr]) regMap[cIdStr] = {};
             regMap[cIdStr][dStr] = r;
        });

        // 4. Generar operaciones con lógica de estados contractuales y marcas manuales
        const operaciones = [];
        let candidatosProcessados = 0;

        for (const candidato of candidatos) {
            const cId = candidato._id;
            const contractStart = candidato.contractStartDate ? new Date(candidato.contractStartDate) : null;
            const isReallyFiniquitado = candidato.status === 'Finiquitado' || candidato.estado === 'Finiquitado' || candidato.status === 'Retirado' || candidato.status === 'De Baja' || candidato.status === 'Rechazado';
            const contractEndRaw = candidato.fechaFiniquito || (isReallyFiniquitado ? candidato.contractEndDate : null);
            const contractEnd = contractEndRaw ? new Date(contractEndRaw) : null;

            // Enriquecer con datos de cliente/proyecto
            const proyecto = candidato.projectId || {};
            const cliente = proyecto.cliente || {};
            const clienteNombre = cliente.nombre || '—';
            const proyectoNombre = proyecto.nombreProyecto || candidato.projectName || '—';

            // Procesar cada día del mes
            for (const dia of diasMes) {
                const fechaStr = dia.fecha;
                const fechaDate = new Date(fechaStr + 'T00:00:00.000Z');

                const regExist = regMap[cId.toString()] && regMap[cId.toString()][fechaStr];
                const estadoManual = regExist ? regExist.estado : null;
                // CRÍTICO: usar los nombres correctos del schema
                const tieneMarcas = regExist && (regExist.horaEntrada || regExist.horaSalida);
                // Un registro manual Presente sin marcas también debe ser respetado
                const esManualPresente = regExist && estadoManual === 'Presente' && !regExist.syncContractual && !regExist.syncFromProduccion;
                const isSpecialState = estadoManual && ['Licencia Médica', 'Licencia Maternal/Paternal', 'Accidente del Trabajo', 'Vacaciones', 'Permiso con Goce', 'Permiso sin Goce', 'Suspendido', 'Licencia', 'Permiso'].includes(estadoManual);

                let estado = 'Presente';
                let descuenta = false;
                let isBeforeContract = false;
                let esFeriado = false;
                let esDomingo = false;
                let finiquitado = false;
                let fechaFiniquito = null;

                // LÓGICA DE ESTADO (orden de evaluación es crítico)
                
                // 0. ESTADOS MANUALES ESPECIALES (licencias, vacaciones, etc.)
                if (isSpecialState) {
                    estado = estadoManual;
                    descuenta = regExist.descuentaDia || false;
                }
                // 0b. REGISTRO MANUAL PRESENTE (marcas de reloj o ingreso manual no-sync)
                else if (tieneMarcas || esManualPresente) {
                    estado = 'Presente';
                    descuenta = false;
                }
                // 1. NC: ANTES de contractStartDate
                else if (contractStart && fechaDate < contractStart) {
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
                // 5. AUSENTE (día laboral sin marcas)
                else {
                    estado = 'Ausente';
                    descuenta = true;
                }

                // Crear operación de upsert
                const filterQuery = regExist 
                    ? { _id: regExist._id } 
                    : {
                        empresaRef: req.user.empresaRef,
                        candidatoId: cId,
                        fecha: fechaDate,
                        estadoRegistro: { $ne: 'ANULADO' }
                    };

                operaciones.push({
                    updateOne: {
                        filter: filterQuery,
                        update: {
                            $set: {
                                candidatoId: cId,
                                empresaRef: req.user.empresaRef,
                                fecha: regExist ? regExist.fecha : fechaDate,
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
                                syncContractual: true,
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
            mensaje: `✓ Sincronización Estados: ${candidatosProcessados} candidatos, ${upserted + modified} registros procesados`
        });
    } catch (err) {
        console.error('Error en sync-estados:', err);
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

        if (!registro) {
            return res.json({
                registroId: req.params.id,
                ok: false,
                totalEventos: 0,
                ultimoHashCalculado: null,
                inconsistencias: ['Registro no encontrado o sin acceso']
            });
        }
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
