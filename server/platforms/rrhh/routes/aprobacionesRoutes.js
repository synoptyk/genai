const express = require('express');
const router = express.Router();
const BeneficioTransaccion = require('../models/BeneficioTransaccion');
const DescuentoTransaccion = require('../models/DescuentoTransaccion');
const Notificacion = require('../models/Notificacion');
const { protect } = require('../../auth/authMiddleware');

// Get all pending approvals for RRHH (Beneficios and Descuentos)
router.get('/pendientes', protect, async (req, res) => {
    try {
        const beneficios = await BeneficioTransaccion.find({
            empresaRef: req.user.empresaRef,
        })
        .populate('candidatoRef', 'fullName rut position')
        .populate('tipoBeneficioRef', 'nombre codigoDT')
        .sort({ createdAt: -1 });

        const descuentos = await DescuentoTransaccion.find({
            empresaRef: req.user.empresaRef,
        })
        .populate('candidatoRef', 'fullName rut position')
        .populate('tipoDescuentoRef', 'nombre codigoDT')
        .sort({ createdAt: -1 });

        res.json({ beneficios, descuentos });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Approve/Reject Beneficio
router.put('/beneficios/:id/estado', protect, async (req, res) => {
    try {
        const { estado, comentarioAprobador, firmaBase64 } = req.body;
        const tx = await BeneficioTransaccion.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { 
                estadoAprobacion: estado, 
                motivoRechazo: estado === 'Rechazado' ? comentarioAprobador : '',
                respaldoUrl: (estado === 'Aprobado' && firmaBase64) ? 'Firma Aprobaciones360' : ''
            },
            { new: true }
        );

        if (!tx) return res.status(404).json({ message: 'Beneficio no encontrado' });

        await Notificacion.create({
            empresaRef: req.user.empresaRef,
            candidatoRef: tx.candidatoRef,
            tipo: 'Informativa',
            titulo: `Beneficio ${estado}`,
            mensaje: `El beneficio salarial ha sido ${estado.toLowerCase()} por gerencia.`,
            refId: tx._id,
            refModel: 'BeneficioTransaccion',
            requiereFirma: false,
            estadoFirma: 'Firmado'
        });

        res.json(tx);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Approve/Reject Descuento
router.put('/descuentos/:id/estado', protect, async (req, res) => {
    try {
        const { estado, comentarioAprobador, firmaBase64 } = req.body;
        const tx = await DescuentoTransaccion.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { 
                estadoAprobacion: estado, 
                motivoRechazo: estado === 'Rechazado' ? comentarioAprobador : '',
                respaldoUrl: (estado === 'Aprobado' && firmaBase64) ? 'Firma Aprobaciones360' : ''
            },
            { new: true }
        );

        if (!tx) return res.status(404).json({ message: 'Descuento no encontrado' });

        await Notificacion.create({
            empresaRef: req.user.empresaRef,
            candidatoRef: tx.candidatoRef,
            tipo: 'Informativa',
            titulo: `Descuento ${estado}`,
            mensaje: `El descuento ha sido ${estado.toLowerCase()} por gerencia.`,
            refId: tx._id,
            refModel: 'DescuentoTransaccion',
            requiereFirma: false,
            estadoFirma: 'Firmado'
        });

        res.json(tx);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
