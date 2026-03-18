const Plantilla = require('../models/Plantilla');

const plantillaController = {
    getAll: async (req, res) => {
        try {
            const plantillas = await Plantilla.find().sort({ lastMod: -1 });
            res.json(plantillas);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    getById: async (req, res) => {
        try {
            const plantilla = await Plantilla.findById(req.params.id);
            if (!plantilla) return res.status(404).json({ message: 'Plantilla no encontrada' });
            res.json(plantilla);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    create: async (req, res) => {
        const plantilla = new Plantilla(req.body);
        try {
            const nuevaPlantilla = await plantilla.save();
            res.status(201).json(nuevaPlantilla);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    update: async (req, res) => {
        try {
            const plantilla = await Plantilla.findByIdAndUpdate(req.params.id, { ...req.body, lastMod: Date.now() }, { new: true });
            if (!plantilla) return res.status(404).json({ message: 'Plantilla no encontrada' });
            res.json(plantilla);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    remove: async (req, res) => {
        try {
            const plantilla = await Plantilla.findByIdAndDelete(req.params.id);
            if (!plantilla) return res.status(404).json({ message: 'Plantilla no encontrada' });
            res.json({ message: 'Plantilla eliminada' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = plantillaController;
