const express = require('express');
const router = express.Router();
const RegistroAsistencia = require('../models/RegistroAsistencia');
const Candidato = require('../models/Candidato');
const Tecnico = require('../../agentetelecom/models/Tecnico');
const Actividad = require('../../agentetelecom/models/Actividad');
const { protect, authorize } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');
const feriadosUtil = require('../../utils/feriadosUtil');

// ─── GET /asistencia ─ Listado (por fecha o por mes/año) ─────────────────────
router.get('/', protect, async (req, res) => {
    try {
        const { fecha, candidatoId, month, year } = req.query;
        const filter = { empresaRef: req.user.empresaRef };
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
            .populate('turnoId', 'nombre horaEntrada horaSalida color toleranciaTardanza')
            .sort({ fecha: 1, 'candidatoId.fullName': 1 });
        res.json(registros);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── GET /asistencia/resumen-periodo ─ Resumen mensual por colaborador ────────
// Usado por NominaRRHH para sincronizar días trabajados y horas extra reales
router.get('/resumen-periodo', protect, async (req, res) => {
    try {
        const { month, year } = req.query;
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
            .populate('candidatoId', 'fullName rut position cargo projectName status toaId idRecursoToa contractStartDate contractEndDate fechaFiniquito')
            .populate('turnoId', 'nombre horasTrabajo colacionMinutos')
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

// ─── POST /asistencia ─ Crear o actualizar registro individual (upsert) ───────
// Usa upsert para evitar E11000 cuando ya existe un registro para ese candidato/fecha.
// Si existe → actualiza. Si no → crea. Retorna el documento poblado en ambos casos.
router.post('/', protect, async (req, res) => {
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

        const update = {
            $set: {
                ...rest,
                candidatoId,
                fecha: fechaDate,
                empresaRef: req.user.empresaRef,
            }
        };

        const saved = await RegistroAsistencia.findOneAndUpdate(filter, update, {
            new:    true,
            upsert: true,
            setDefaultsOnInsert: true,
            // runValidators omitido: causa errores con tipoAusencia: null en $set (Mongoose enum + runValidators)
        })
            .populate('candidatoId', 'fullName rut position cargo projectName projectId status')
            .populate('turnoId', 'nombre horaEntrada horaSalida color');

        res.status(201).json(saved);
    } catch (err) {
        console.error('POST /asistencia error:', err.message);
        res.status(400).json({ message: err.message });
    }
});

// ─── POST /asistencia/bulk ─ Inserción masiva ─────────────────────────────────
router.post('/bulk', protect, async (req, res) => {
    try {
        const { registros } = req.body;
        const con = registros.map(r => ({ ...r, empresaRef: req.user.empresaRef }));
        const result = await RegistroAsistencia.insertMany(con, { ordered: false });
        res.status(201).json({ insertados: result.length });
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─── POST /asistencia/bulk-upsert ─ Inserción/actualización masiva (sin duplicar) ─
router.post('/bulk-upsert', protect, async (req, res) => {
    try {
        const { registros } = req.body;
        const ops = registros.map(r => {
            // Normalizar fecha a medianoche UTC — consistente con el índice único
            const fechaDate = new Date(r.fecha);
            fechaDate.setUTCHours(0, 0, 0, 0);
            return {
                updateOne: {
                    filter: {
                        empresaRef:  req.user.empresaRef,
                        candidatoId: r.candidatoId,
                        fecha:       fechaDate,          // exacto, no rango — el índice es por fecha UTC
                    },
                    update: { $set: { ...r, fecha: fechaDate, empresaRef: req.user.empresaRef } },
                    upsert: true,
                }
            };
        });
        const result = await RegistroAsistencia.bulkWrite(ops);
        res.json({ upserted: result.upsertedCount, modified: result.modifiedCount });
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// ─── PUT /asistencia/:id ─ Actualizar registro ────────────────────────────────
router.put('/:id', protect, async (req, res) => {
    try {
        const updated = await RegistroAsistencia.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        ).populate('candidatoId', 'fullName rut position')
         .populate('turnoId', 'nombre horaEntrada horaSalida color');
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── DELETE /asistencia/:id ────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
    try {
        const result = await RegistroAsistencia.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Registro eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── POST /asistencia/sync-toa ─ Auto-sync attendance based on TOA production ───
router.post('/sync-toa', protect, authorize('asistencia:editar', ROLES.ADMIN, ROLES.CEO, ROLES.RRHH), async (req, res) => {
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
                            fecha: dateUTC
                        },
                        update: {
                            $set: {
                                candidatoId: c._id,
                                empresaRef: req.user.empresaRef,
                                fecha: dateUTC,
                                estado: nuevoEstado,
                                descuentaDia: descuenta,
                                automaticoTOA: true
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

// ─── POST /asistencia/sync-from-produccion ─ Nueva sincronización mejorada ───────
// Sincroniza asistencia desde Producción (Actividad) usando feriadosUtil
// Reglas:
// 1. NC (No Contratado): fechas previas a contractStartDate
// 2. Feriado: fechas en lista de feriados + domingos = Libre
// 3. Si hay producción (Actividad.puntos > 0) → Presente
// 4. Si no hay producción → Ausente (descuenta)
router.post('/sync-from-produccion', protect, authorize('asistencia:editar', ROLES.ADMIN, ROLES.CEO, ROLES.RRHH), async (req, res) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) return res.status(400).json({ message: 'month y year requeridos' });

        const m = Number(month);
        const y = Number(year);

        // 1. Obtener días del mes con propiedades de feriados/domingos
        const diasMes = feriadosUtil.getDiasDelMes(y, m);

        // 2. Obtener Candidatos de la empresa
        const candidatos = await Candidato.find({
            empresaRef: req.user.empresaRef,
        }).lean();

        // 3. Obtener Técnicos para mapeo de idRecursoToa
        const tecnicos = await Tecnico.find({
            empresaRef: req.user.empresaRef,
        }).lean();

        // Mapeo: idRecursoToa → Tecnico
        const tecnicosPorIdToa = {};
        tecnicos.forEach(t => {
            if (t.idRecursoToa) {
                tecnicosPorIdToa[t.idRecursoToa] = t;
            }
        });

        // 4. Obtener Actividades (producción) del período
        const firstDay = new Date(Date.UTC(y, m - 1, 1));
        const lastDay = new Date(Date.UTC(y, m, 0, 23, 59, 59));

        const actividades = await Actividad.find({
            empresaRef: req.user.empresaRef,
            fecha: { $gte: firstDay, $lte: lastDay }
        }).lean();

        // Mapeo: { fechaStr: { idRecursoToa: { totalPuntos } } }
        const prodPorFecha = {};
        actividades.forEach(a => {
            const dateStr = feriadosUtil.toDateString(new Date(a.fecha));
            if (!prodPorFecha[dateStr]) prodPorFecha[dateStr] = {};

            const pts = parseFloat(a.Pts_Total_Baremo) || parseFloat(a.puntos) || 0;
            if (!prodPorFecha[dateStr][a.Recurso]) {
                prodPorFecha[dateStr][a.Recurso] = 0;
            }
            prodPorFecha[dateStr][a.Recurso] += pts;
        });

        // 5. Generar operaciones de upsert
        const operaciones = [];

        candidatos.forEach(candidato => {
            const cId = candidato._id;
            const idRecursoToa = candidato.idRecursoToa;
            const contractStart = candidato.contractStartDate ? new Date(candidato.contractStartDate) : null;
            const contractEnd = candidato.contractEndDate || candidato.fechaFiniquito ? new Date(candidato.contractEndDate || candidato.fechaFiniquito) : null;

            // Recorrer días del mes
            diasMes.forEach(dia => {
                const fechaStr = dia.fecha;
                const fechaDate = new Date(fechaStr + 'T12:00:00Z');

                // Determinar estado
                let estado = 'Presente';
                let descuenta = false;
                let isBeforeContract = false;
                let esFeriado = false;
                let esDomingo = false;

                // 1. NC: antes de contrato
                if (contractStart && fechaDate < contractStart) {
                    estado = 'NC';
                    isBeforeContract = true;
                    descuenta = false;
                }
                // 2. Terminado: después de fin contrato
                else if (contractEnd && fechaDate > contractEnd) {
                    estado = 'NC'; // Considera fin contrato como NC
                    isBeforeContract = true;
                    descuenta = false;
                }
                // 3. Feriado
                else if (dia.esFeriado) {
                    estado = 'Feriado';
                    esFeriado = true;
                    descuenta = false;
                }
                // 4. Domingo
                else if (dia.esDomingo) {
                    estado = 'Libre';
                    esDomingo = true;
                    descuenta = false;
                }
                // 5. Verificar producción (SI ES CONTRATADO Y NO ES FERIADO/DOMINGO)
                else {
                    const pts = prodPorFecha[fechaStr] && idRecursoToa
                        ? (prodPorFecha[fechaStr][idRecursoToa] || 0)
                        : 0;

                    if (pts > 0) {
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
                            fecha: fechaDate
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
                                syncFromProduccion: true,
                            }
                        },
                        upsert: true
                    }
                });
            });
        });

        // 6. Ejecutar bulkWrite
        let upserted = 0, modified = 0;
        if (operaciones.length > 0) {
            const result = await RegistroAsistencia.bulkWrite(operaciones);
            upserted = result.upsertedCount || 0;
            modified = result.modifiedCount || 0;
        }

        res.json({
            success: true,
            upserted,
            modified,
            total: upserted + modified,
            mensaje: `Sincronización completa: ${upserted + modified} registros procesados (${upserted} nuevos, ${modified} actualizados)`
        });
    } catch (err) {
        console.error('Error en sync-from-produccion:', err);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /asistencia/validar-contrato ─ Validar coherencia de contratos ─────────
// Verifica que todos los registros sean >= contractStartDate
router.post('/validar-contrato', protect, authorize('asistencia:editar', ROLES.ADMIN, ROLES.CEO, ROLES.RRHH), async (req, res) => {
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
