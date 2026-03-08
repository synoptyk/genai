const express = require('express');
const router = express.Router();
const astController = require('../controllers/astController');
const { protect } = require('../../auth/authMiddleware');

router.get('/', protect, astController.getASTs);
router.get('/:id', protect, astController.getASTById);
router.post('/', protect, astController.createAST);
router.put('/:id', protect, astController.updateAST);
router.delete('/:id', protect, astController.deleteAST);

module.exports = router;
