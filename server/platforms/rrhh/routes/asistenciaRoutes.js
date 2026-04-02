const express = require('express');
const router = express.Router();
const RegistroAsistencia = require('../models/RegistroAsistencia');
const Candidato = require('../models/Candidato');
const { protect } = require('../../auth/authMiddleware');

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
            .populate('candidatoId', 'fullName rut position cargo projectName status toaId idRecursoToa')
            .populate('turnoId', 'nombre horasTrabajo')
            .lean();

        // Agrupar por candidato
        const porCandidato = {};
        registros.forEach(r => {
            const cId = r.candidatoId?._id?.toString() || r.candidatoId?.toString();
            if (!cId) return;
            if (!porCandidato[cId]) {
                porCandidato[cId] = {
                    candidatoId: cId,
                    nombre: r.candidatoId?.fullName || '—',
                    rut: r.candidatoId?.rut || '',
                    cargo: r.candidatoId?.position || r.candidatoId?.cargo || '',
                    datosCandidato: r.candidatoId, // Persistimos los datos para cálculos de proporcionalidad
                    diasPresente:    0,
                    diasTardanza:    0,
                    diasAusente:     0,
                    diasLicencia:    0,
                    diasPermiso:     0,
                    diasVacaciones:  0,
                    diasFeriado:     0,
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
            }
            if (r.descuentaDia) c.diasDescontados++;
            if (r.estado === 'Presente' || r.estado === 'Tardanza') {
                c.horasNormalesTrabajadas += r.turnoId?.horasTrabajo || 0;
                c.horasNormalesTrabajadas += (r.turnoId?.colacionMinutos / 60) || 0; // Si el turno descuenta colación, aquí sumamos la jornada bruta o neta?
                // En realidad horasTrabajo del modelo suele ser la jornada pactada. 
                // Sumamos el valor del modelo para obtener el acumulado mensual.
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

            const diasTrabajadosCalculados = Math.max(0, diasBasePeriodo - c.diasAusente - c.diasLicencia);

            return {
                ...c,
                diasTrabajados: diasTrabajadosCalculados,
                diasBasePeriodo,
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

module.exports = router;
