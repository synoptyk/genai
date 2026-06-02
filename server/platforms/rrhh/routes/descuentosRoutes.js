const express = require('express');
const router = express.Router();
const TipoDescuento = require('../../admin/models/TipoDescuento');
const DescuentoTransaccion = require('../models/DescuentoTransaccion');
const Notificacion = require('../models/Notificacion');
const { protect } = require('../../auth/authMiddleware');

const DEFAULT_DESCUENTOS = [
    { nombre: 'Anticipo de Sueldo', codigoDT: '4101', limiteLegalPorcentaje: 0, descripcionLegal: 'Adelanto de remuneraciones.' },
    { nombre: 'Préstamo Empresa', codigoDT: '4102', limiteLegalPorcentaje: 30, descripcionLegal: 'Préstamo otorgado por el empleador (Art 58 inc 1, Tope 30%).' },
    { nombre: 'Préstamo CCAF', codigoDT: '4103', limiteLegalPorcentaje: 0, descripcionLegal: 'Crédito Caja de Compensación.' },
    { nombre: 'Cuota Sindical', codigoDT: '4104', limiteLegalPorcentaje: 0, descripcionLegal: 'Descuento autorizado por cuota de sindicato.' },
    { nombre: 'Cuota Bienestar', codigoDT: '4105', limiteLegalPorcentaje: 0, descripcionLegal: 'Aporte a departamento o servicio de bienestar.' },
    { nombre: 'Retención Judicial', codigoDT: '4106', limiteLegalPorcentaje: 50, descripcionLegal: 'Descuento por pensión alimenticia u orden judicial.' },
    { nombre: 'Préstamo Habitacional', codigoDT: '4107', limiteLegalPorcentaje: 30, descripcionLegal: 'Préstamo para adquisición de vivienda.' },
    { nombre: 'Descuento por Atrasos', codigoDT: '4108', limiteLegalPorcentaje: 0, descripcionLegal: 'Descuento calculado por minutos/horas de atraso.', requiereCantidad: true, unidadMedida: 'Horas' },
    { nombre: 'Descuento por Inasistencias', codigoDT: '4109', limiteLegalPorcentaje: 0, descripcionLegal: 'Descuento calculado por días no trabajados.', requiereCantidad: true, unidadMedida: 'Días' },
    { nombre: 'Pérdida / Daño Material', codigoDT: '4110', limiteLegalPorcentaje: 0, descripcionLegal: 'Descuento por extravío o daño (requiere acuerdo).' },
    { nombre: 'Otros Descuentos', codigoDT: '4199', limiteLegalPorcentaje: 0, descripcionLegal: 'Otros descuentos voluntarios permitidos por la ley.' },
];

// Seed and get all tipos de descuento
router.get('/tipos', protect, async (req, res) => {
    try {
        // Upsert default discounts to ensure they always have latest fields (requiereCantidad, etc)
        const defaultsToInsert = DEFAULT_DESCUENTOS.map(d => ({
            updateOne: {
                filter: { empresaRef: req.user.empresaRef, codigoDT: d.codigoDT },
                update: { $set: { ...d, empresaRef: req.user.empresaRef, isEstandar: true } },
                upsert: true
            }
        }));
        await TipoDescuento.bulkWrite(defaultsToInsert);

        const tipos = await TipoDescuento.find({ empresaRef: req.user.empresaRef });
        res.json(tipos);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new tipo de descuento
router.post('/tipos', protect, async (req, res) => {
    try {
        const { nombre, codigoDT, limiteLegalPorcentaje, descripcionLegal } = req.body;
        const tipo = new TipoDescuento({
            empresaRef: req.user.empresaRef,
            nombre, codigoDT, limiteLegalPorcentaje, descripcionLegal
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
        const tipo = await TipoDescuento.findOneAndUpdate(
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
        let transacciones = await DescuentoTransaccion.find({
            empresaRef: req.user.empresaRef,
            periodo: req.params.periodo
        }).populate('tipoDescuentoRef');

        // Motor de Cuotas Recurrentes
        if (transacciones.length === 0) {
            const [year, month] = req.params.periodo.split('-');
            let prevMonth = parseInt(month) - 1;
            let prevYear = parseInt(year);
            if (prevMonth === 0) { prevMonth = 12; prevYear--; }
            const prevPeriodo = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

            const prevCuotas = await DescuentoTransaccion.find({
                empresaRef: req.user.empresaRef,
                periodo: prevPeriodo,
                modalidad: 'Cuotas'
            }).populate('tipoDescuentoRef');

            const toInsert = prevCuotas.filter(c => c.cuotaActual < c.numeroCuotasTotal).map(c => ({
                empresaRef: c.empresaRef,
                candidatoRef: c.candidatoRef,
                tipoDescuentoRef: c.tipoDescuentoRef._id || c.tipoDescuentoRef,
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
                await DescuentoTransaccion.insertMany(toInsert);
                transacciones = await DescuentoTransaccion.find({
                    empresaRef: req.user.empresaRef,
                    periodo: req.params.periodo
                }).populate('tipoDescuentoRef');
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

        // Get existing transactions to protect signatures
        const existingTx = await DescuentoTransaccion.find({
            empresaRef: req.user.empresaRef,
            candidatoRef: candidatoId,
            periodo
        });
        
        const tiposCache = {};
        for (const t of transacciones) {
            if (!tiposCache[t.tipoDescuentoRef]) {
                tiposCache[t.tipoDescuentoRef] = await TipoDescuento.findById(t.tipoDescuentoRef);
            }
        }

        const validIncoming = transacciones.filter(t => (t.monto && t.monto > 0) || t.cantidad > 0);
        const incomingIds = validIncoming.map(t => t.id).filter(id => id && id.length === 24); // only valid objectIds

        // 1. Delete transactions that are NOT in the incoming list AND have NOT been signed
        const toDelete = existingTx.filter(tx => !incomingIds.includes(tx._id.toString()));
        for (const tx of toDelete) {
            if (tx.estadoAprobacion === 'Pendiente' || tx.estadoAprobacion === 'Rechazado' || !tx.respaldoUrl) {
                await DescuentoTransaccion.findByIdAndDelete(tx._id);
                await Notificacion.deleteMany({ refId: tx._id, refModel: 'DescuentoTransaccion' });
            }
        }

        // 2. Process incoming transactions
        const notificacionesToInsert = [];
        
        for (const t of validIncoming) {
            const tipo = tiposCache[t.tipoDescuentoRef];
            const isAcuerdo = tipo && ['4101', '4102', '4107', '4110'].includes(tipo.codigoDT);
            const isNew = !t.id || t.id.length !== 24;
            
            let txDoc = null;
            if (!isNew) {
                txDoc = existingTx.find(tx => tx._id.toString() === t.id);
            }

            if (txDoc) {
                // UPDATE
                const montoCambiado = Number(txDoc.monto) !== Number(t.monto);
                
                // If amount changed and it was an agreement, invalidate signature
                if (montoCambiado && isAcuerdo && (txDoc.estadoAprobacion === 'Aprobado' || txDoc.estadoAprobacion === 'Rechazado')) {
                    txDoc.estadoAprobacion = 'Pendiente';
                    txDoc.respaldoUrl = '';
                    txDoc.motivoRechazo = '';
                    
                    // Create a new notification
                    notificacionesToInsert.push({
                        empresaRef: req.user.empresaRef,
                        candidatoRef: candidatoId,
                        tipo: 'Tramite',
                        titulo: 'Monto Modificado: Firma Requerida',
                        mensaje: `Se modificó el monto del descuento por ${tipo?.nombre} a $${t.monto}. Se requiere nueva firma.`,
                        refId: txDoc._id,
                        refModel: 'DescuentoTransaccion',
                        requiereFirma: true,
                        estadoFirma: 'Pendiente'
                    });
                }
                
                txDoc.monto = t.monto;
                txDoc.cantidad = t.cantidad || 0;
                txDoc.modalidad = t.modalidad || '';
                txDoc.numeroCuotasTotal = t.numeroCuotasTotal || null;
                txDoc.cuotaActual = t.cuotaActual || null;
                txDoc.fechasInasistencia = t.fechasInasistencia || [];
                txDoc.fechaAtraso = t.fechaAtraso || null;
                txDoc.nota = t.nota || notaGeneral || '';
                
                await txDoc.save();
                
            } else {
                // INSERT
                const newTx = new DescuentoTransaccion({
                    empresaRef: req.user.empresaRef,
                    candidatoRef: candidatoId,
                    tipoDescuentoRef: t.tipoDescuentoRef,
                    periodo,
                    monto: t.monto,
                    cantidad: t.cantidad || 0,
                    modalidad: t.modalidad || '',
                    numeroCuotasTotal: t.numeroCuotasTotal || null,
                    cuotaActual: t.cuotaActual || null,
                    fechasInasistencia: t.fechasInasistencia || [],
                    fechaAtraso: t.fechaAtraso || null,
                    nota: t.nota || notaGeneral || '',
                    estadoAprobacion: isAcuerdo ? 'Pendiente' : 'Aprobado'
                });
                
                const inserted = await newTx.save();
                
                notificacionesToInsert.push({
                    empresaRef: req.user.empresaRef,
                    candidatoRef: candidatoId,
                    tipo: isAcuerdo ? 'Tramite' : 'Informativa',
                    titulo: isAcuerdo ? 'Firma Requerida: Autorización de Descuento' : 'Nuevo Descuento Registrado',
                    mensaje: `Se ha registrado un descuento por concepto de ${tipo?.nombre || 'Descuento'} por un monto de $${inserted.monto}. ${isAcuerdo ? 'Por favor revisa y firma la autorización legal.' : 'Este descuento ha sido registrado y no requiere firma extra.'}`,
                    refId: inserted._id,
                    refModel: 'DescuentoTransaccion',
                    requiereFirma: isAcuerdo,
                    estadoFirma: isAcuerdo ? 'Pendiente' : 'Firmado'
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

// Upload Masivo de Descuentos
router.post('/upload/:periodo', protect, async (req, res) => {
    try {
        const { periodo } = req.params;
        const data = req.body; // Array of { 'RUT': '...', 'CÓDIGO DT': '...', 'MONTO': ..., 'CANTIDAD': ..., 'JUSTIFICACIÓN': ... }

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ errors: ['El archivo está vacío o el formato es incorrecto'] });
        }

        const errors = [];
        const successCount = 0;

        // Fetch all candidates for the company
        const candidatos = await Candidato.find({ empresaRef: req.user.empresaRef, isActive: true });
        const tipos = await TipoDescuento.find({ empresaRef: req.user.empresaRef });

        const RUT_FIELD = 'RUT';
        const CODIGO_FIELD = 'CÓDIGO DT';
        const MONTO_FIELD = 'MONTO';
        const CANTIDAD_FIELD = 'CANTIDAD';
        const NOTA_FIELD = 'JUSTIFICACIÓN';

        const toInsertOrUpdate = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rawRut = row[RUT_FIELD];
            const rawCodigo = row[CODIGO_FIELD];
            const rawMonto = row[MONTO_FIELD];
            const rawCantidad = row[CANTIDAD_FIELD];
            const rawNota = row[NOTA_FIELD] || 'Carga Masiva';

            if (!rawRut || !rawCodigo || (rawMonto === undefined && rawCantidad === undefined)) {
                errors.push(`Fila ${i + 2}: Faltan datos requeridos (RUT, CÓDIGO o MONTO/CANTIDAD).`);
                continue;
            }

            const formattedRut = formatRut(rawRut);
            const cand = candidatos.find(c => c.rut === formattedRut);
            if (!cand) {
                errors.push(`Fila ${i + 2}: Candidato con RUT ${rawRut} no encontrado o inactivo.`);
                continue;
            }

            const tipo = tipos.find(t => t.codigoDT === rawCodigo?.toString() || t.nombre === rawCodigo);
            if (!tipo) {
                errors.push(`Fila ${i + 2}: Tipo de descuento con código ${rawCodigo} no encontrado.`);
                continue;
            }

            const montoNum = Number(rawMonto) || 0;
            const cantidadNum = Number(rawCantidad) || 0;
            
            if (montoNum < 0 || cantidadNum < 0) {
                errors.push(`Fila ${i + 2}: Monto o Cantidad inválidos.`);
                continue;
            }

            // Optional validations can go here (e.g. check >45% max limit)

            toInsertOrUpdate.push({
                empresaRef: req.user.empresaRef,
                candidatoRef: cand._id,
                tipoDescuentoRef: tipo._id,
                periodo,
                monto: montoNum,
                cantidad: cantidadNum,
                modalidad: 'Totalidad',
                estadoAprobacion: tipo.requiereAprobacion ? 'Pendiente' : 'Aprobado',
                nota: rawNota,
                creadoPor: req.user._id
            });
        }

        if (errors.length > 0) {
            return res.json({ errors }); // Return errors so UI can display them
        }

        // Apply changes
        for (const op of toInsertOrUpdate) {
            // Find if exists
            const exists = await DescuentoTransaccion.findOne({
                empresaRef: op.empresaRef,
                candidatoRef: op.candidatoRef,
                tipoDescuentoRef: op.tipoDescuentoRef,
                periodo: op.periodo
            });

            if (exists) {
                exists.monto = op.monto;
                exists.cantidad = op.cantidad;
                exists.nota = op.nota;
                exists.actualizadoPor = req.user._id;
                await exists.save();
            } else {
                await DescuentoTransaccion.create(op);
                
                if (op.estadoAprobacion === 'Pendiente') {
                    // Generar notificación de aprobación si es necesario
                    const cand = candidatos.find(c => c._id.toString() === op.candidatoRef.toString());
                    const Aprobacion = require('../../models/Aprobacion');
                    await Aprobacion.create({
                        empresaRef: req.user.empresaRef,
                        tipo: 'Descuento',
                        referenciaId: op.candidatoRef,
                        referenciaModelo: 'Candidato',
                        candidatoRef: op.candidatoRef,
                        solicitanteRef: req.user._id,
                        detalles: {
                            mensaje: `Aprobación de Descuento por Carga Masiva para ${cand?.fullName}`,
                            descuentoId: op.tipoDescuentoRef,
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
