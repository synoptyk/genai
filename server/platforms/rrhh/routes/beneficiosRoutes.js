const express = require('express');
const router = express.Router();
const TipoBeneficio = require('../../admin/models/TipoBeneficio');
const BeneficioTransaccion = require('../models/BeneficioTransaccion');
const Notificacion = require('../models/Notificacion');
const { protect } = require('../../auth/authMiddleware');

const DEFAULT_BENEFICIOS = [
    { nombre: 'Aguinaldo', codigoDT: '2023', descripcionLegal: 'Aguinaldo voluntario u obligatorio por fiestas.' },
    { nombre: 'Bono Compensatorio', codigoDT: '2024', descripcionLegal: 'Bono compensatorio voluntario.' },
    { nombre: 'Bono Escolaridad', codigoDT: '2025', descripcionLegal: 'Bono asociado a escolaridad de cargas.' },
    { nombre: 'Anticipo de Sueldo (Haber)', codigoDT: '2026', descripcionLegal: 'Monto anticipado otorgado al trabajador.' },
    { nombre: 'Asignación de Matrimonio', codigoDT: '2027', descripcionLegal: 'Bono por matrimonio.' },
    { nombre: 'Asignación de Nacimiento', codigoDT: '2028', descripcionLegal: 'Bono por nacimiento de hijo.' },
    { nombre: 'Otros Beneficios', codigoDT: '2099', descripcionLegal: 'Otros haberes o beneficios voluntarios.' },
];

// Seed and get all tipos de beneficio
router.get('/tipos', protect, async (req, res) => {
    try {
        const defaultsToInsert = DEFAULT_BENEFICIOS.map(b => ({
            updateOne: {
                filter: { empresaRef: req.user.empresaRef, codigoDT: b.codigoDT },
                update: { $set: { ...b, empresaRef: req.user.empresaRef, isEstandar: true } },
                upsert: true
            }
        }));
        await TipoBeneficio.bulkWrite(defaultsToInsert);

        const tipos = await TipoBeneficio.find({ empresaRef: req.user.empresaRef });
        res.json(tipos);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new tipo de beneficio
router.post('/tipos', protect, async (req, res) => {
    try {
        const { nombre, codigoDT, descripcionLegal } = req.body;
        const tipo = new TipoBeneficio({
            empresaRef: req.user.empresaRef,
            nombre, codigoDT, descripcionLegal
        });
        await tipo.save();
        res.status(201).json(tipo);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update tipo
router.put('/tipos/:id', protect, async (req, res) => {
    try {
        const tipo = await TipoBeneficio.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        res.json(tipo);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get transacciones by period
router.get('/transacciones/:periodo', protect, async (req, res) => {
    try {
        let transacciones = await BeneficioTransaccion.find({
            empresaRef: req.user.empresaRef,
            periodo: req.params.periodo
        }).populate('tipoBeneficioRef');

        // Motor de Cuotas Recurrentes (Para beneficios diferidos)
        if (transacciones.length === 0) {
            const [year, month] = req.params.periodo.split('-');
            let prevMonth = parseInt(month) - 1;
            let prevYear = parseInt(year);
            if (prevMonth === 0) { prevMonth = 12; prevYear--; }
            const prevPeriodo = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

            const prevCuotas = await BeneficioTransaccion.find({
                empresaRef: req.user.empresaRef,
                periodo: prevPeriodo,
                modalidad: 'Cuotas'
            }).populate('tipoBeneficioRef');

            const toInsert = prevCuotas.filter(c => c.cuotaActual < c.numeroCuotasTotal).map(c => ({
                empresaRef: c.empresaRef,
                candidatoRef: c.candidatoRef,
                tipoBeneficioRef: c.tipoBeneficioRef._id || c.tipoBeneficioRef,
                periodo: req.params.periodo,
                monto: c.monto,
                cantidad: c.cantidad,
                modalidad: c.modalidad,
                numeroCuotasTotal: c.numeroCuotasTotal,
                cuotaActual: (c.cuotaActual || 0) + 1,
                nota: c.nota,
                respaldoUrl: c.respaldoUrl,
                estadoAprobacion: c.estadoAprobacion
            }));

            if (toInsert.length > 0) {
                await BeneficioTransaccion.insertMany(toInsert);
                transacciones = await BeneficioTransaccion.find({
                    empresaRef: req.user.empresaRef,
                    periodo: req.params.periodo
                }).populate('tipoBeneficioRef');
            }
        }

        res.json(transacciones);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Save (upsert) transacciones for a candidate and period
router.post('/transacciones/:candidatoId/:periodo', protect, async (req, res) => {
    try {
        const { candidatoId, periodo } = req.params;
        const { transacciones, notaGeneral } = req.body; 

        const existingTx = await BeneficioTransaccion.find({
            empresaRef: req.user.empresaRef,
            candidatoRef: candidatoId,
            periodo
        });
        
        const tiposCache = {};
        for (const t of transacciones) {
            if (!tiposCache[t.tipoBeneficioRef]) {
                tiposCache[t.tipoBeneficioRef] = await TipoBeneficio.findById(t.tipoBeneficioRef);
            }
        }

        const validIncoming = transacciones.filter(t => (t.monto && t.monto > 0) || t.cantidad > 0);
        const incomingIds = validIncoming.map(t => t.id).filter(id => id && id.length === 24);

        // Delete missing
        const toDelete = existingTx.filter(tx => !incomingIds.includes(tx._id.toString()));
        for (const tx of toDelete) {
            if (tx.estadoAprobacion === 'Pendiente' || tx.estadoAprobacion === 'Rechazado' || !tx.respaldoUrl) {
                await BeneficioTransaccion.findByIdAndDelete(tx._id);
                await Notificacion.deleteMany({ refId: tx._id, refModel: 'BeneficioTransaccion' });
            }
        }

        // Process incoming
        const notificacionesToInsert = [];
        
        for (const t of validIncoming) {
            const tipo = tiposCache[t.tipoBeneficioRef];
            const isAcuerdo = false; // By default benefits dont require strict deduction signatures, unless policy mandates it.
            const isNew = !t.id || t.id.length !== 24;
            
            let txDoc = null;
            if (!isNew) {
                txDoc = existingTx.find(tx => tx._id.toString() === t.id);
            }

            if (txDoc) {
                // UPDATE
                txDoc.monto = t.monto;
                txDoc.cantidad = t.cantidad || 0;
                txDoc.modalidad = t.modalidad || '';
                txDoc.numeroCuotasTotal = t.numeroCuotasTotal || null;
                txDoc.cuotaActual = t.cuotaActual || null;
                txDoc.nota = t.nota || notaGeneral || '';
                
                await txDoc.save();
                
            } else {
                // INSERT
                const newTx = new BeneficioTransaccion({
                    empresaRef: req.user.empresaRef,
                    candidatoRef: candidatoId,
                    tipoBeneficioRef: t.tipoBeneficioRef,
                    periodo,
                    monto: t.monto,
                    cantidad: t.cantidad || 0,
                    modalidad: t.modalidad || '',
                    numeroCuotasTotal: t.numeroCuotasTotal || null,
                    cuotaActual: t.cuotaActual || null,
                    nota: t.nota || notaGeneral || '',
                    estadoAprobacion: 'Pendiente'
                });
                
                const inserted = await newTx.save();
                
                notificacionesToInsert.push({
                    empresaRef: req.user.empresaRef,
                    candidatoRef: candidatoId,
                    tipo: 'Informativa',
                    titulo: 'Nuevo Beneficio Registrado',
                    mensaje: `Se ha registrado un beneficio por concepto de ${tipo?.nombre || 'Beneficio'} por un monto de $${inserted.monto}.`,
                    refId: inserted._id,
                    refModel: 'BeneficioTransaccion',
                    requiereFirma: true,
                    estadoFirma: 'Pendiente'
                });
            }
        }

        if (notificacionesToInsert.length > 0) {
            await Notificacion.insertMany(notificacionesToInsert);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

const { formatRut } = require('../../../utils/rutUtils');

// Upload Masivo de Beneficios
router.post('/upload/:periodo', protect, async (req, res) => {
    try {
        const { periodo } = req.params;
        const data = req.body; // Array of { 'RUT': '...', 'CÓDIGO TIPO BENEFICIO': '...', 'MONTO': ... }

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ errors: ['El archivo está vacío o el formato es incorrecto'] });
        }

        const errors = [];
        const successCount = 0;

        // Fetch all candidates for the company
        const candidatos = await Candidato.find({ empresaRef: req.user.empresaRef, isActive: true });
        const tipos = await TipoBeneficio.find({ empresaRef: req.user.empresaRef });

        const RUT_FIELD = 'RUT';
        const CODIGO_FIELD = 'CÓDIGO TIPO BENEFICIO';
        const MONTO_FIELD = 'MONTO';

        const toInsertOrUpdate = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rawRut = row[RUT_FIELD];
            const rawCodigo = row[CODIGO_FIELD];
            const rawMonto = row[MONTO_FIELD];

            if (!rawRut || !rawCodigo || rawMonto === undefined) {
                errors.push(`Fila ${i + 2}: Faltan datos requeridos (RUT, CÓDIGO o MONTO).`);
                continue;
            }

            const formattedRut = formatRut(rawRut);
            const cand = candidatos.find(c => c.rut === formattedRut);
            if (!cand) {
                errors.push(`Fila ${i + 2}: Candidato con RUT ${rawRut} no encontrado o inactivo.`);
                continue;
            }

            const tipo = tipos.find(t => t.codigoLRE === rawCodigo?.toString() || t.nombre === rawCodigo);
            if (!tipo) {
                errors.push(`Fila ${i + 2}: Tipo de beneficio con código ${rawCodigo} no encontrado.`);
                continue;
            }

            const montoNum = Number(rawMonto);
            if (isNaN(montoNum) || montoNum < 0) {
                errors.push(`Fila ${i + 2}: Monto inválido (${rawMonto}).`);
                continue;
            }

            // Validations
            if (tipo.limiteMonto && montoNum > tipo.limiteMonto) {
                errors.push(`Fila ${i + 2}: Monto excede el límite permitido para ${tipo.nombre}.`);
                continue;
            }

            toInsertOrUpdate.push({
                empresaRef: req.user.empresaRef,
                candidatoRef: cand._id,
                tipoBeneficioRef: tipo._id,
                periodo,
                monto: montoNum,
                modalidad: 'Totalidad',
                estadoAprobacion: tipo.requiereAprobacion ? 'Pendiente' : 'Aprobado',
                nota: 'Carga Masiva',
                creadoPor: req.user._id
            });
        }

        if (errors.length > 0) {
            return res.json({ errors }); // Return errors so UI can display them
        }

        // Apply changes
        for (const op of toInsertOrUpdate) {
            // Find if exists
            const exists = await BeneficioTransaccion.findOne({
                empresaRef: op.empresaRef,
                candidatoRef: op.candidatoRef,
                tipoBeneficioRef: op.tipoBeneficioRef,
                periodo: op.periodo
            });

            if (exists) {
                exists.monto = op.monto;
                exists.nota = op.nota;
                exists.actualizadoPor = req.user._id;
                await exists.save();
            } else {
                await BeneficioTransaccion.create(op);
                
                if (op.estadoAprobacion === 'Pendiente') {
                    // Generar notificación de aprobación si es necesario
                    const cand = candidatos.find(c => c._id.toString() === op.candidatoRef.toString());
                    const Aprobacion = require('../../models/Aprobacion');
                    await Aprobacion.create({
                        empresaRef: req.user.empresaRef,
                        tipo: 'Beneficio',
                        referenciaId: op.candidatoRef,
                        referenciaModelo: 'Candidato',
                        candidatoRef: op.candidatoRef,
                        solicitanteRef: req.user._id,
                        detalles: {
                            mensaje: `Aprobación de Beneficio por Carga Masiva para ${cand?.fullName}`,
                            beneficioId: op.tipoBeneficioRef,
                            periodo: op.periodo,
                            monto: op.monto
                        },
                        estado: 'Pendiente',
                        nivelActual: 1,
                        pasos: [{
                            nivel: 1,
                            rolRequerido: 'gerencia',
                            estado: 'Pendiente'
                        }]
                    });
                }
            }
        }

        res.json({ message: 'Carga masiva completada' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error procesando archivo', error: err.message });
    }
});

module.exports = router;
