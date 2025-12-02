const express = require('express');
const router = express.Router();
const FacultyController = require('../controllers/facultyController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/announcements', authenticateToken, requireRole('faculty', 'admin'), FacultyController.createAnnouncement);
router.get('/announcements', authenticateToken, FacultyController.getAnnouncements);
router.put('/announcements/:announcementId', authenticateToken, requireRole('faculty', 'admin'), FacultyController.updateAnnouncement);
router.delete('/announcements/:announcementId', authenticateToken, requireRole('faculty', 'admin'), FacultyController.deleteAnnouncement);
router.post('/bookings/:bookingId/override', authenticateToken, requireRole('faculty'), FacultyController.overrideBooking);
router.get('/courses', authenticateToken, FacultyController.getCourses);

module.exports = router;

