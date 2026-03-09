const express = require('express');
const router = express.Router();
const Combustible = require('../models/Combustible');
const Tecnico = require('../../agentetelecom/models/Tecnico'); // To get supervisor info

// 1. Submit fuel request (Technician)
router.post('/', async (req, res) => {
    try {
        const { rut, patente, kmActual, fotoTacometro, nombre } = req.body;
        if (!rut || !patente || !kmActual || !fotoTacometro) {
            return res.status(400).json({ error: "Faltan campos obligatorios" });
        }

        // Find technician to get their supervisor automatically
        const tecnico = await Tecnico.findOne({ rut: rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim() });
        const supervisorId = tecnico?.supervisor;

        const nuevaSolicitud = new Combustible({
            rut,
            nombre,
            patente,
            kmActual,
            fotoTacometro,
            supervisorId,
            estado: 'Pendiente'
        });

        await nuevaSolicitud.save();
        res.status(201).json(nuevaSolicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get requests for a supervisor
router.get('/supervisor/:supervisorId', async (req, res) => {
    try {
        const solicitudes = await Combustible.find({ supervisorId: req.params.supervisorId })
            .sort({ fecha: -1 });
        res.json(solicitudes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Update status (Approve/Reject/Carga Realizada)
router.put('/:id/estado', async (req, res) => {
    try {
        const { estado, comentarioSupervisor } = req.body;
        const solicitud = await Combustible.findByIdAndUpdate(
            req.params.id,
            { estado, comentarioSupervisor, notificado: true },
            { new: true }
        );
        if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });
        res.json(solicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get individual status (Technician notification)
router.get('/rut/:rut/reciente', async (req, res) => {
    try {
        const rutLimpio = req.params.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
        const solicitud = await Combustible.findOne({ rut: req.params.rut })
            .sort({ fecha: -1 });
        res.json(solicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Get last registered KM for a vehicle
router.get('/patente/:patente/last-km', async (req, res) => {
    try {
        const patente = req.params.patente.toUpperCase().trim();
        const lastRequest = await Combustible.findOne({ patente, estado: { $ne: 'Rechazado' } })
            .sort({ fecha: -1 });
        res.json({ lastKm: lastRequest ? lastRequest.kmActual : 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
