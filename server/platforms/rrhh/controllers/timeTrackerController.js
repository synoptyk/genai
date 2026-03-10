const TimeTracker = require('../models/TimeTracker');
const User = require('../../auth/UserGenAi'); // Import global User model

// 1. Recibir latido de tiempo desde el Frontend
exports.registrarLatido = async (req, res) => {
    try {
        const { segundosIncremental } = req.body;
        const user = req.user;

        // Solo aplica para ciertos roles, pero el frontend puede manejar el filtro principal. 
        // Backend también valida para consistencia.
        if (user.role !== 'administrativo' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Rol no autorizado para trackeo de tiempo' });
        }

        const hoy = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" local/UTC

        // Buscar o crear el documento del día para este usuario
        let tracker = await TimeTracker.findOne({ userRef: user._id, fecha: hoy });

        if (!tracker) {
            tracker = new TimeTracker({
                userRef: user._id,
                empresaRef: user.empresaRef,
                fecha: hoy,
                segundosTrabajados: 0
            });
        }

        // Incrementar los segundos que el cliente reporta que estuvo activo (ej. cada 60 seg)
        tracker.segundosTrabajados += (segundosIncremental || 60);
        tracker.ultimaActividad = new Date();

        await tracker.save();

        res.json({ success: true, totalHoy: tracker.segundosTrabajados });
    } catch (error) {
        console.error("Error registrando tiempo:", error);
        res.status(500).json({ error: error.message });
    }
};

// 2. CEO/Admin consulta los tiempos trabajados del día
exports.getReporteTiempos = async (req, res) => {
    try {
        const fechaConsulta = req.query.fecha || new Date().toISOString().split('T')[0];

        // El CEO ve todos, el admin ve los de su empresa.
        let filtro = { fecha: fechaConsulta };
        if (req.user.role !== 'ceo' && req.user.role !== 'ceo_genai') {
            filtro.empresaRef = req.user.empresaRef;
        }

        // Buscar los trackers y poblar el nombre y rol del usuario
        const trackers = await TimeTracker.find(filtro)
            .populate('userRef', 'name rut email role cargo')
            .sort({ segundosTrabajados: -1 });

        res.json(trackers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
