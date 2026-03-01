const express = require('express');
const router = express.Router();
const EmpresaConfig = require('../models/EmpresaConfig');

// GET current config (always returns one single document or creates it)
router.get('/', async (req, res) => {
    try {
        let config = await EmpresaConfig.findOne();
        if (!config) {
            config = new EmpresaConfig({
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
router.put('/', async (req, res) => {
    try {
        let config = await EmpresaConfig.findOne();
        if (!config) config = new EmpresaConfig();

        Object.assign(config, req.body);
        await config.save();
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
