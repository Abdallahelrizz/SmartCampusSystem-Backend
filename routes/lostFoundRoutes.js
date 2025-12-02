const express = require('express');
const router = express.Router();
const LostFoundController = require('../controllers/lostFoundController');
const { authenticateToken } = require('../middleware/auth');

router.post('/report', authenticateToken, LostFoundController.reportItem);
router.post('/', authenticateToken, LostFoundController.reportItem);
router.get('/items', authenticateToken, LostFoundController.getItems);
router.get('/', authenticateToken, LostFoundController.getItems);
router.post('/:itemId/claim', authenticateToken, LostFoundController.claimItem);

module.exports = router;

