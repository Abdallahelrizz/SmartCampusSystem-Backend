const express = require('express');
const router = express.Router();
const PreventiveMaintenanceController = require('../controllers/preventiveMaintenanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/', authenticateToken, requireRole('admin', 'maintenance'), PreventiveMaintenanceController.createTask);
router.get('/', authenticateToken, requireRole('maintenance'), PreventiveMaintenanceController.getTasks);
router.put('/:taskId/status', authenticateToken, requireRole('maintenance'), PreventiveMaintenanceController.updateTaskStatus);
router.get('/daily-summary', authenticateToken, requireRole('maintenance', 'admin'), PreventiveMaintenanceController.generateDailySummary);

module.exports = router;

