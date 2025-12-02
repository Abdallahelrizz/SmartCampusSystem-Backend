const express = require('express');
const router = express.Router();
const NursingController = require('../controllers/nursingController');
const { authenticateToken } = require('../middleware/auth');

router.get('/slots', authenticateToken, NursingController.getAvailableSlots);
router.post('/book', authenticateToken, NursingController.bookAppointment);
router.get('/my-appointments', authenticateToken, NursingController.getMyAppointments);
router.post('/cancel/:appointmentId', authenticateToken, NursingController.cancelAppointment);

module.exports = router;

