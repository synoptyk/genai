const Procedimiento = require('../models/Procedimiento');

exports.getProcedimientos = async (req, res) => {
    try {
        const procs = await Procedimiento.find().sort({ createdAt: -1 });
        res.json(procs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createProcedimiento = async (req, res) => {
    try {
        const proc = new Procedimiento(req.body);
        await proc.save();
        res.status(201).json(proc);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
