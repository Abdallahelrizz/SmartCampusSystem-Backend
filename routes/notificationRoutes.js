const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, NotificationController.getNotifications);
router.get('/all', authenticateToken, requireRole('admin'), NotificationController.getAllNotifications);
router.put('/:notificationId/read', authenticateToken, NotificationController.markAsRead);
router.put('/read-all', authenticateToken, NotificationController.markAllAsRead);

module.exports = router;

