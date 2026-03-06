const express = require('express');
const router = express.Router();
const EmpresaConfig = require('../models/EmpresaConfig');
const { protect } = require('../../auth/authMiddleware');

// GET current config (always returns one single document or creates it)
router.get('/', protect, async (req, res) => {
    try {
        if (!req.user.empresaRef) {
            // Un CEO Gen AI sin empresaRef vinculada no debería intentar grabar una config global con ObjectId inválido.
            return res.json({
                cargos: [], areas: [], cecos: [], projectTypes: [], approvalWorkflows: []
            });
        }

        // 🔒 FILTRO POR EMPRESA
        let config = await EmpresaConfig.findOne({ empresaRef: req.user.empresaRef });
        if (!config) {
            config = new EmpresaConfig({
                empresaRef: req.user.empresaRef, // 🔒 INYECTAR
                cargos: [],
                areas: [],
                cecos: [],
                projectTypes: [],
                approvalWorkflows: []
            });
            await config.save();
        }
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// UPDATE generic config fields
router.put('/', protect, async (req, res) => {
    try {
        if (!req.user.empresaRef) {
            return res.status(400).json({ error: "El usuario actual no pertenece a una empresa específica" });
        }

        // 🔒 FILTRO POR EMPRESA
        let config = await EmpresaConfig.findOne({ empresaRef: req.user.empresaRef });
        if (!config) {
            config = new EmpresaConfig({ empresaRef: req.user.empresaRef });
        }

        Object.assign(config, req.body);
        await config.save();
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
