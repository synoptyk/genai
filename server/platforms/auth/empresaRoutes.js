const express = require('express');
const router = express.Router();
const empresaController = require('./empresaController');
const { protect, authorize } = require('./authMiddleware');

// Validar que solo el CEO o Admin general pueda gestionar las empresas
router.use(protect);
// Eliminamos router.use(authorize) global para evitar conflictos con guardias específicas por ruta

// El Administrador del Sistema tiene acceso total a crear, borrar y ver el listado de TODAS las empresas
router.route('/')
    .get(authorize('system_admin', 'ceo'), empresaController.getEmpresas)
    .post(authorize('system_admin', 'ceo'), empresaController.createEmpresa);

// El Administrador Maestro solo puede ver y editar su PROPIA empresa mapeada
router.route('/mi-empresa')
    .get(authorize('admin', 'system_admin', 'ceo', 'cfg_empresa'), empresaController.getMiEmpresa)
    .put(authorize('admin', 'system_admin', 'ceo', 'cfg_empresa:editar'), empresaController.updateMiEmpresa);

// El Administrador del Sistema tiene acceso total a cuentas ajenas mediante ID
router.route('/:id')
    .get(authorize('system_admin', 'ceo'), empresaController.getEmpresaById)
    .put(authorize('system_admin', 'ceo'), empresaController.updateEmpresa)
    .delete(authorize('system_admin', 'ceo'), empresaController.deleteEmpresa);

module.exports = router;
