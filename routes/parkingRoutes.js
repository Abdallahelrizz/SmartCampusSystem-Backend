const express = require('express');
const router = express.Router();
const ParkingController = require('../controllers/parkingController');
const { authenticateToken } = require('../middleware/auth');

router.get('/available', authenticateToken, ParkingController.getAvailableSpaces);
router.post('/reserve', authenticateToken, ParkingController.reserveSpace);
router.get('/my/reservations', authenticateToken, ParkingController.getMyReservations);
router.get('/my-reservation', authenticateToken, ParkingController.getMyReservation);
router.post('/cancel/:spaceId', authenticateToken, ParkingController.cancelReservation);

module.exports = router;

