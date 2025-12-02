const express = require('express');
const router = express.Router();
const EventController = require('../controllers/eventController');
const { authenticateToken } = require('../middleware/auth');

const { requireRole } = require('../middleware/auth');

router.post('/', authenticateToken, EventController.createEvent);
router.get('/', authenticateToken, EventController.getAllEvents);
router.get('/pending', authenticateToken, requireRole('admin'), EventController.getPendingEvents);
router.post('/approve/:eventId', authenticateToken, requireRole('admin'), EventController.approveEvent);
router.post('/reject/:eventId', authenticateToken, requireRole('admin'), EventController.rejectEvent);
router.get('/my/tickets', authenticateToken, EventController.getMyTickets);
router.delete('/tickets/:ticketId', authenticateToken, EventController.cancelTicket);
router.get('/:eventId', authenticateToken, EventController.getEventById);
router.put('/:eventId', authenticateToken, EventController.updateEvent);
router.delete('/:eventId', authenticateToken, EventController.deleteEvent);
router.post('/:eventId/reserve', authenticateToken, EventController.reserveTicket);

module.exports = router;

