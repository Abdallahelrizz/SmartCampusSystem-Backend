const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/chatbotController');
const { authenticateToken } = require('../middleware/auth');

router.post('/chat', authenticateToken, ChatbotController.getResponse);

module.exports = router;

