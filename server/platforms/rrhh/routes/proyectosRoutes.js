const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Proyecto = require('../models/Proyecto');
const Empresa = require('../../auth/models/Empresa');
const { protect, authorize } = require('../../auth/authMiddleware');

// Helper to clean empty string ObjectId fields so Mongoose doesn't fail to cast them
const sanitizeProyectoInput = (body) => {
    const data = { ...body };
    // Normalizar cliente: si es objeto populado, extraer solo el _id
    if (data.cliente === '' || data.cliente === undefined) {
        data.cliente = null;
    } else if (data.cliente && typeof data.cliente === 'object' && data.cliente._id) {
        data.cliente = data.cliente._id;
    }
    if (Array.isArray(data.dotacion)) {
        data.dotacion = data.dotacion
            // Filtrar dotaciones sin cargo (incompletas) para evitar error de validación requerida
            .filter(d => d.cargo && d.cargo.trim() !== '' && (d.cantidad || 0) >= 1)
            .map(d => {
                const dot = { ...d };
                // Eliminar _id del subdocumento: Mongoose lo regenera al hacer update
                delete dot._id;
                if (Array.isArray(dot.bonos)) {
                    dot.bonos = dot.bonos
                        .filter(b => b.bonoRef || b.description) // omitir bonos vacíos
                        .map(b => {
                            const bono = { ...b };
                            // Normalizar bonoRef: si es objeto populado, extraer _id
                            if (bono.bonoRef === '' || bono.bonoRef === undefined) {
                                bono.bonoRef = null;
                            } else if (bono.bonoRef && typeof bono.bonoRef === 'object' && bono.bonoRef._id) {
                                bono.bonoRef = bono.bonoRef._id;
                            }
                            return bono;
                        });
                }
                return dot;
            });
    }
    return data;
};

router.use(protect);

router.get('/', authorize('admin_proyectos:ver', 'rrhh_captura:ver', 'cfg_clientes:ver', 'admin_mis_clientes:ver', 'rend_tarifario:ver'), async (req, res) => {
    try {
        let empresaRef = req.user.empresaRef;
        if (!empresaRef && req.user?.empresa?.nombre) {
            const emp = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
            empresaRef = emp?._id;
        }
        if (!empresaRef) return res.json([]);

        // 🔒 FILTRO POR EMPRESA - POPULATE CLIENTE
        const proyectos = await Proyecto.find({ empresaRef })
            .populate('cliente')
            .sort({ createdAt: -1 });
        res.json(proyectos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', authorize('admin_proyectos:ver'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'ID de proyecto inválido' });
        }

        let empresaRef = req.user.empresaRef;
        if (!empresaRef && req.user?.empresa?.nombre) {
            const emp = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
            empresaRef = emp?._id;
        }

        // 🔒 FILTRO POR EMPRESA
        const p = await Proyecto.findOne({ _id: req.params.id, empresaRef }).populate('cliente');
        if (!p) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(p);
    } catch (err) { 
        console.error("❌ GET /:id error:", err);
        res.status(500).json({ message: err.message, stack: err.stack }); 
    }
});

router.post('/', authorize('admin_proyectos:crear'), async (req, res) => {
    try {
        let empresaRef = req.user.empresaRef;
        if (!empresaRef && req.user?.empresa?.nombre) {
            const emp = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
            empresaRef = emp?._id;
        }

        const sanitizedBody = sanitizeProyectoInput(req.body);

        // 🔒 INYECTAR EMPRESA
        const proyecto = new Proyecto({
            ...sanitizedBody,
            empresaRef
        });
        const saved = await proyecto.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', authorize('admin_proyectos:editar'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'ID de proyecto inválido' });
        }

        let empresaRef = req.user.empresaRef;
        if (!empresaRef && req.user?.empresa?.nombre) {
            const emp = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
            empresaRef = emp?._id;
        }

        const sanitizedBody = sanitizeProyectoInput(req.body);

        // Evitar error de Mongoose al intentar modificar campos inmutables
        delete sanitizedBody._id;
        delete sanitizedBody.empresaRef;

        // 🔒 FILTRO POR EMPRESA
        const updated = await Proyecto.findOneAndUpdate(
            { _id: req.params.id, empresaRef },
            sanitizedBody,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { 
        console.error("❌ PUT /:id error:", err);
        res.status(500).json({ message: err.message, stack: err.stack }); 
    }
});

router.delete('/:id', authorize('admin_proyectos:eliminar'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'ID de proyecto inválido' });
        }

        let empresaRef = req.user.empresaRef;
        if (!empresaRef && req.user?.empresa?.nombre) {
            const emp = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
            empresaRef = emp?._id;
        }

        // 🔒 FILTRO POR EMPRESA
        const result = await Proyecto.findOneAndDelete({ _id: req.params.id, empresaRef });
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Proyecto eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

