const express = require('express');
const router = express.Router();
const Notificacion = require('../models/Notificacion');
const DescuentoTransaccion = require('../models/DescuentoTransaccion');
const { protect } = require('../../auth/authMiddleware');

// Get all notifications for the logged in user (Colaborador)
// Note: In Portal Colaborador, the user is logged in via their RUT (or similar),
// but typically req.user._id is the Candidato ID if they are using the Colaborador Portal.
// We need to match by candidatoRef. Let's assume req.user.candidatoRef or req.user._id is available.
router.get('/', protect, async (req, res) => {
    try {
        // If the logged in user is a Colaborador, their role might be 'op_colaborador' and their id is the candidatoId
        const candidatoId = req.user.candidatoRef || req.user._id; 
        
        const notificaciones = await Notificacion.find({
            candidatoRef: candidatoId,
        }).sort({ createdAt: -1 });
        
        res.json(notificaciones);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Marcar como leída
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notif = await Notificacion.findByIdAndUpdate(req.params.id, { leida: true }, { new: true });
        res.json(notif);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Firmar / Aprobar Trámite (Firma Electrónica Avanzada)
router.post('/:id/firmar', protect, async (req, res) => {
    try {
        const { pdfUrl, datosFirma } = req.body;
        
        const notif = await Notificacion.findById(req.params.id);
        if (!notif) return res.status(404).json({ message: 'Notificación no encontrada' });
        
        if (notif.requiereFirma) {
            notif.estadoFirma = 'Firmado';
            notif.pdfUrl = pdfUrl; // Could be a Base64 string for now
            notif.datosFirma = datosFirma;
            notif.leida = true;
            await notif.save();
            
            // If it's a Descuento, update the DescuentoTransaccion to 'Aprobado'
            if (notif.refModel === 'DescuentoTransaccion' && notif.refId) {
                await DescuentoTransaccion.findByIdAndUpdate(notif.refId, { 
                    estadoAprobacion: 'Aprobado',
                    respaldoUrl: pdfUrl // Save the signed PDF as the backup
                });
            }
        }
        
        res.json(notif);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Rechazar Trámite
router.post('/:id/rechazar', protect, async (req, res) => {
    try {
        const { motivoRechazo } = req.body;
        
        const notif = await Notificacion.findById(req.params.id);
        if (!notif) return res.status(404).json({ message: 'Notificación no encontrada' });
        
        if (notif.requiereFirma) {
            notif.estadoFirma = 'Rechazado';
            notif.motivoRechazo = motivoRechazo;
            notif.leida = true;
            await notif.save();
            
            if (notif.refModel === 'DescuentoTransaccion' && notif.refId) {
                await DescuentoTransaccion.findByIdAndUpdate(notif.refId, { 
                    estadoAprobacion: 'Rechazado',
                    motivoRechazo: motivoRechazo
                });
            }
        }
        
        res.json(notif);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
