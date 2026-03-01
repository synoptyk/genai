const express = require('express');
const router = express.Router();
const charlaController = require('../controllers/charlaController');

router.get('/', charlaController.getCharlas);
router.post('/', charlaController.createCharla);

module.exports = router;
