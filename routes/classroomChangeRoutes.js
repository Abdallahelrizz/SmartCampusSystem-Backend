const express = require('express');
const router = express.Router();
const ClassroomChangeController = require('../controllers/classroomChangeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/request', authenticateToken, requireRole('faculty'), ClassroomChangeController.requestChange);
router.get('/my-requests', authenticateToken, requireRole('faculty'), ClassroomChangeController.getMyRequests);
router.get('/pending', authenticateToken, requireRole('admin'), ClassroomChangeController.getPendingRequests);
router.post('/approve/:requestId', authenticateToken, requireRole('admin'), ClassroomChangeController.approveRequest);
router.post('/reject/:requestId', authenticateToken, requireRole('admin'), ClassroomChangeController.rejectRequest);

module.exports = router;

