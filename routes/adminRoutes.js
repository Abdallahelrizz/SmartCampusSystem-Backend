const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/bookings/pending', authenticateToken, requireRole('admin'), AdminController.getPendingBookings);
router.post('/bookings/:requestId/approve', authenticateToken, requireRole('admin'), AdminController.approveBooking);
router.post('/bookings/:requestId/reject', authenticateToken, requireRole('admin'), AdminController.rejectBooking);
router.get('/users', authenticateToken, requireRole('admin'), AdminController.getAllUsers);
router.get('/users/pending', authenticateToken, requireRole('admin'), AdminController.getPendingUsers);
router.post('/users/:userId/approve', authenticateToken, requireRole('admin'), AdminController.approveUser);
router.post('/users/:userId/reject', authenticateToken, requireRole('admin'), AdminController.rejectUser);
router.put('/users/:userId/status', authenticateToken, requireRole('admin'), AdminController.updateUserStatus);
router.put('/users/:userId/role', authenticateToken, requireRole('admin'), AdminController.updateUserRole);
router.post('/issues/:issueId/assign', authenticateToken, requireRole('admin'), AdminController.reassignIssue);
router.put('/resources/:resourceId/status', authenticateToken, requireRole('admin'), AdminController.updateResourceStatus);
router.post('/resources', authenticateToken, requireRole('admin'), AdminController.createResource);
router.post('/notifications/broadcast', authenticateToken, requireRole('admin'), AdminController.broadcastNotification);
router.get('/activity-logs', authenticateToken, requireRole('admin'), AdminController.getActivityLogs);
router.get('/suspicious-activity', authenticateToken, requireRole('admin'), AdminController.getSuspiciousActivity);

module.exports = router;

