const express = require('express');
const router = express.Router();
const EmpresaConfig = require('../models/EmpresaConfig');
const { protect } = require('../../auth/authMiddleware');

// Helper: Normalize cecos/areas from old string format to new object format
const normalizeCecos = (arr = []) => arr.map(item =>
    typeof item === 'string' ? { nombre: item, subCecos: [] } : item
);
const normalizeAreas = (arr = []) => arr.map(item =>
    typeof item === 'string' ? { nombre: item, departamentos: [] } : item
);
const normalizeCargos = (arr = []) => arr.map(item =>
    typeof item === 'string' ? { nombre: item, categoria: 'Operativo' } : item
);
const normalizeDepartamentos = (arr = []) => arr.map(item =>
    typeof item === 'string' ? { nombre: item } : item
);

// GET current config
router.get('/', protect, async (req, res) => {
    try {
        if (!req.user.empresaRef) {
            return res.json({
                cargos: [], areas: [], cecos: [], projectTypes: [], approvalWorkflows: [], history: []
            });
        }

        let config = await EmpresaConfig.findOne({ empresaRef: req.user.empresaRef });
        if (!config) {
            config = new EmpresaConfig({
                empresaRef: req.user.empresaRef,
                cargos: [], areas: [], cecos: [], projectTypes: [], approvalWorkflows: []
            });
            await config.save();
        }

        // Devolver con normalización para el frontend
        const out = config.toObject();
        out.cecos = normalizeCecos(out.cecos);
        out.areas = normalizeAreas(out.areas);
        out.cargos = normalizeCargos(out.cargos);
        out.departamentos = normalizeDepartamentos(out.departamentos);
        res.json(out);
    } catch (e) {
        console.error('GET /config error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// UPDATE config
router.put('/', protect, async (req, res) => {
    try {
        if (!req.user.empresaRef) {
            return res.status(400).json({ error: "El usuario actual no pertenece a una empresa específica" });
        }

        let config = await EmpresaConfig.findOne({ empresaRef: req.user.empresaRef });
        if (!config) {
            config = new EmpresaConfig({ empresaRef: req.user.empresaRef });
        }

        // Normalizar antes de guardar para no romper schema
        const body = { ...req.body };
        if (body.cecos) body.cecos = normalizeCecos(body.cecos);
        if (body.areas) body.areas = normalizeAreas(body.areas);
        if (body.cargos) body.cargos = normalizeCargos(body.cargos);
        if (body.departamentos) body.departamentos = normalizeDepartamentos(body.departamentos);

        const historyEntry = {
            action: 'Actualización de Configuración',
            description: `Se actualizaron los parámetros generales de la empresa`,
            user: req.user.email || req.user.name || 'Usuario',
            timestamp: new Date()
        };

        // Solo actualizar campos conocidos, no sobreescribir _id ni empresaRef
        const allowedFields = ['cargos', 'areas', 'cecos', 'projectTypes', 'departamentos', 'approvalWorkflows', 'logo'];
        allowedFields.forEach(field => {
            if (body[field] !== undefined) config[field] = body[field];
        });

        config.history.unshift(historyEntry);
        if (config.history.length > 50) config.history.pop();

        await config.save();

        const out = config.toObject();
        out.cecos = normalizeCecos(out.cecos);
        out.areas = normalizeAreas(out.areas);
        out.cargos = normalizeCargos(out.cargos);
        out.departamentos = normalizeDepartamentos(out.departamentos);
        res.json(out);
    } catch (e) {
        console.error('PUT /config error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

