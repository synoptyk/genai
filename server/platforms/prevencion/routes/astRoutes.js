const express = require('express');
const router = express.Router();
const astController = require('../controllers/astController');
const { protect, authorize } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

router.use(protect);

router.get('/', (req, res, next) => {
  const r = (req.query.rut || "").replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
  const ur = (req.user.rut || "").replace(/\./g, "").replace(/-/g, "").toUpperCase().trim();
  if (r && ur && r === ur) return next();
  authorize('prev_ast:ver', ROLES.SUPERVISOR, ROLES.TECNICO, 'user', 'operativo')(req, res, next);
}, astController.getASTs);
router.get('/:id', authorize('prev_ast:ver', ROLES.SUPERVISOR), astController.getASTById);
router.post('/', authorize('prev_ast:crear'), astController.createAST);
router.put('/:id', authorize('prev_ast:editar'), astController.updateAST);
router.delete('/:id', authorize('prev_ast:eliminar'), astController.deleteAST);

module.exports = router;
