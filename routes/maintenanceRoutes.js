const express = require('express');
const router = express.Router();
const MaintenanceController = require('../controllers/maintenanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/issues', authenticateToken, requireRole('maintenance'), MaintenanceController.getAssignedIssues);
router.post('/issues/:issueId/assign', authenticateToken, requireRole('maintenance'), MaintenanceController.assignIssue);
router.put('/facility-status', authenticateToken, requireRole('maintenance'), MaintenanceController.updateFacilityStatus);
router.get('/cleaning-tasks', authenticateToken, requireRole('maintenance'), MaintenanceController.getCleaningTasks);
router.post('/cleaning-tasks/:taskId/complete', authenticateToken, requireRole('maintenance'), MaintenanceController.completeCleaningTask);
router.put('/cleaning-tasks/:taskId/checklist', authenticateToken, requireRole('maintenance'), MaintenanceController.updateChecklistItem);

module.exports = router;

