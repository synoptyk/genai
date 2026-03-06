const Procedimiento = require('../models/Procedimiento');

exports.getProcedimientos = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const procs = await Procedimiento.find({ empresaRef: req.user.empresaRef }).sort({ createdAt: -1 });
        res.json(procs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createProcedimiento = async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA
        const proc = new Procedimiento({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        await proc.save();
        res.status(201).json(proc);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
