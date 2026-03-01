const Charla = require('../models/Charla');

exports.getCharlas = async (req, res) => {
    try {
        const charlas = await Charla.find().sort({ createdAt: -1 });
        res.json(charlas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createCharla = async (req, res) => {
    try {
        const charla = new Charla(req.body);
        await charla.save();
        res.status(201).json(charla);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
