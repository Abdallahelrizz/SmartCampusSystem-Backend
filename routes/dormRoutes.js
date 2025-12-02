const express = require('express');
const router = express.Router();
const DormController = require('../controllers/dormController');
const { authenticateToken } = require('../middleware/auth');

router.get('/available', authenticateToken, DormController.getAvailableDorms);
router.post('/book', authenticateToken, DormController.bookDorm);
router.post('/cancel/:dormId', authenticateToken, DormController.cancelDorm);
router.get('/my-reservation', authenticateToken, DormController.getMyReservation);

module.exports = router;

