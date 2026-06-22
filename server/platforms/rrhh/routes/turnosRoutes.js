const express = require('express');
const router = express.Router();
const Turno = require('../models/Turno');
const { protect, authorize } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

router.get('/', protect, authorize('rrhh_turnos:ver', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR), async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const turnos = await Turno.find({ activo: true, empresaRef: req.user.empresaRef })
            .populate('colominoAsignados', 'fullName rut');
        res.json(turnos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', protect, authorize('rrhh_turnos:crear', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA
        const turno = new Turno({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        const saved = await turno.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', protect, authorize('rrhh_turnos:editar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const updated = await Turno.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Assign/unassign colaborador to turno
router.put('/:id/asignar', protect, authorize('rrhh_turnos:editar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR), async (req, res) => {
    try {
        const { candidatoId, action } = req.body;
        if (!candidatoId || !['add', 'remove'].includes(action)) {
            return res.status(400).json({ message: 'candidatoId y action(add/remove) son obligatorios' });
        }
        // 🔒 FILTRO POR EMPRESA
        const turno = await Turno.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!turno) return res.status(404).json({ message: 'Turno no encontrado o sin acceso' });
        const candidatoIdStr = String(candidatoId);
        if (action === 'add') {
            const exists = turno.colominoAsignados.some(id => String(id) === candidatoIdStr);
            if (!exists) turno.colominoAsignados.push(candidatoId);
        } else {
            turno.colominoAsignados = turno.colominoAsignados.filter(id => String(id) !== candidatoIdStr);
        }
        await turno.save();
        res.json(turno);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Asignación Masiva
router.put('/:id/asignar-bulk', protect, authorize('rrhh_turnos:editar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA, ROLES.SUPERVISOR), async (req, res) => {
    try {
        const { candidatoIds } = req.body;
        if (!Array.isArray(candidatoIds)) return res.status(400).json({ message: 'candidatoIds debe ser un arreglo' });
        // 🔒 FILTRO POR EMPRESA
        const turno = await Turno.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!turno) return res.status(404).json({ message: 'Turno no encontrado o sin acceso' });
        
        // Agregar los IDs que no estén ya en la lista
        const currentAsignados = turno.colominoAsignados.map(id => id.toString());
        candidatoIds.forEach(id => {
            if (!currentAsignados.includes(id)) {
                turno.colominoAsignados.push(id);
            }
        });
        await turno.save();
        res.json(turno);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', protect, authorize('rrhh_turnos:eliminar', ROLES.SYSTEM_ADMIN, ROLES.CEO_GENAI, ROLES.ADMIN, ROLES.CEO, ROLES.RRHH, ROLES.GERENCIA), async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const result = await Turno.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { activo: false },
            { new: true }
        );
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Turno eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
