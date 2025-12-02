const express = require('express');
const router = express.Router();
const TutoringController = require('../controllers/tutoringController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, TutoringController.createSession);
router.get('/', authenticateToken, TutoringController.getSessions);
router.get('/sessions', authenticateToken, TutoringController.getSessions);
router.post('/:sessionId/reserve', authenticateToken, TutoringController.reserveSession);
router.delete('/sessions/:sessionId', authenticateToken, TutoringController.deleteSession);

module.exports = router;

