const express = require('express');
const router = express.Router();
const plantillaController = require('../controllers/plantillaController');

router.get('/', plantillaController.getAll);
router.get('/:id', plantillaController.getById);
router.post('/', plantillaController.create);
router.put('/:id', plantillaController.update);
router.delete('/:id', plantillaController.remove);

module.exports = router;
