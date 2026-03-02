const express = require('express');
const router = express.Router();
const empresaController = require('./empresaController');
const { protect, authorize } = require('./authMiddleware');

// Validar que solo el CEO o Admin general pueda gestionar las empresas
router.use(protect);
router.use(authorize('ceo_genai', 'admin'));

router.route('/')
    .get(empresaController.getEmpresas)
    .post(empresaController.createEmpresa);

router.route('/:id')
    .get(empresaController.getEmpresaById)
    .put(empresaController.updateEmpresa)
    .delete(empresaController.deleteEmpresa);

module.exports = router;
