const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middleware/auth');

router.post('/request', authenticateToken, BookingController.createRequest);
router.get('/my-requests', authenticateToken, BookingController.getMyRequests);
router.get('/my-bookings', authenticateToken, BookingController.getMyBookings);
router.get('/all', authenticateToken, BookingController.getAllBookings);
router.post('/cancel/:bookingId', authenticateToken, BookingController.cancelBooking);
router.get('/resources', authenticateToken, BookingController.getAvailableResources);
router.post('/waitlist', authenticateToken, BookingController.addToWaitlist);
router.get('/waitlist', authenticateToken, BookingController.getMyWaitlist);

module.exports = router;

