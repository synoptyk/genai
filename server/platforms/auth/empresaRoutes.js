const express = require('express');
const router = express.Router();
const empresaController = require('./empresaController');
const { protect, authorize } = require('./authMiddleware');

// Validar que solo el CEO o Admin general pueda gestionar las empresas
router.use(protect);
router.use(authorize('ceo_genai', 'admin'));

// CEO Gen Ai tiene acceso total a crear, borrar y ver el listado de TODAS las empresas
router.route('/')
    .get(authorize('ceo_genai'), empresaController.getEmpresas)
    .post(authorize('ceo_genai'), empresaController.createEmpresa);

// El Administrador Maestro solo puede ver y editar su PROPIA empresa mapeada
router.route('/mi-empresa')
    .get(authorize('admin', 'ceo_genai'), empresaController.getMiEmpresa)
    .put(authorize('admin', 'ceo_genai'), empresaController.updateMiEmpresa);

// CEO Gen Ai tiene acceso total a cuentas ajenas mediante ID
router.route('/:id')
    .get(authorize('ceo_genai'), empresaController.getEmpresaById)
    .put(authorize('ceo_genai'), empresaController.updateEmpresa)
    .delete(authorize('ceo_genai'), empresaController.deleteEmpresa);

module.exports = router;
