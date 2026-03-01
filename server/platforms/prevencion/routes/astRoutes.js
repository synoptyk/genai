const express = require('express');
const router = express.Router();
const astController = require('../controllers/astController');

router.get('/', astController.getASTs);
router.get('/:id', astController.getASTById);
router.post('/', astController.createAST);
router.put('/:id', astController.updateAST);
router.delete('/:id', astController.deleteAST);

module.exports = router;
