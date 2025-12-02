const express = require('express');
const router = express.Router();
const TransportationController = require('../controllers/transportationController');
const TransportationAdminController = require('../controllers/transportationAdminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/routes', authenticateToken, TransportationController.getRoutes);
router.post('/reserve', authenticateToken, TransportationController.reserveSeat);
router.get('/my/reservations', authenticateToken, TransportationController.getMyReservations);
router.delete('/reservations/:reservationId', authenticateToken, TransportationController.cancelReservation);
router.post('/admin/routes', authenticateToken, requireRole('admin'), TransportationAdminController.createRoute);
router.put('/admin/routes/:routeId', authenticateToken, requireRole('admin'), TransportationAdminController.updateRoute);
router.delete('/admin/routes/:routeId', authenticateToken, requireRole('admin'), TransportationAdminController.deleteRoute);
router.put('/admin/routes/:routeId/schedule', authenticateToken, requireRole('admin'), TransportationAdminController.updateSchedule);

module.exports = router;

