const express = require('express');
const router = express.Router();
const EmploymentController = require('../controllers/employmentController');
const { authenticateToken } = require('../middleware/auth');

const { requireRole } = require('../middleware/auth');

router.get('/jobs', authenticateToken, EmploymentController.getJobs);
router.post('/apply', authenticateToken, EmploymentController.applyForJob);
router.get('/my-applications', authenticateToken, EmploymentController.getMyApplications);
router.get('/pending', authenticateToken, requireRole('admin'), EmploymentController.getPendingApplications);
router.post('/approve/:applicationId', authenticateToken, requireRole('admin'), EmploymentController.approveApplication);
router.post('/reject/:applicationId', authenticateToken, requireRole('admin'), EmploymentController.rejectApplication);

module.exports = router;

