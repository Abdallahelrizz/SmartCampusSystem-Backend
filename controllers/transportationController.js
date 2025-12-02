const { query } = require('../config/db');
const Notification = require('../models/Notification');
const Transportation = require('../models/Transportation');

class TransportationController {
    static async getRoutes(req, res) {
        try {
            const routes = await query('SELECT * FROM transportationRoutes ORDER BY route_name');
            const { date } = req.query;
            
            const routesWithAvailability = await Promise.all(routes.map(async (route) => {
                let activeReservations = 0;
                
                if (date) {
                    const count = await query(
                        `SELECT COUNT(*) as count FROM transportationReservations 
                         WHERE route_id = ? AND date = ? AND status = 'reserved'`,
                        [route.route_id, date]
                    );
                    activeReservations = count[0].count;
                } else {
                    const count = await query(
                        `SELECT COUNT(*) as count FROM transportationReservations 
                         WHERE route_id = ? AND status = 'reserved'`,
                        [route.route_id]
                    );
                    activeReservations = count[0].count;
                }
                
                return {
                    ...route,
                    reserved_seats: activeReservations,
                    available_seats: Math.max(0, route.capacity - activeReservations)
                };
            }));
            
            res.json(routesWithAvailability);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async reserveSeat(req, res) {
        try {
            const { routeId, date, time } = req.body;
            const userId = req.user.user_id;

            const reservation = await Transportation.reserveSeat(routeId, userId, date, time);
            
            const route = await query(
                'SELECT * FROM transportationRoutes WHERE route_id = ?',
                [routeId]
            );
            
            await Notification.create({
                user_id: userId,
                type: 'transport',
                message: `Seat reserved on ${route[0].route_name} for ${date} at ${time}`,
                notification_method: 'in-app'
            });

            res.status(201).json({ 
                message: 'Seat reserved successfully', 
                reservation 
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async getMyReservations(req, res) {
        try {
            await Transportation.updateExpiredReservations();
            
            const reservations = await Transportation.getUserReservations(req.user.user_id);
            const routes = await query('SELECT * FROM transportationRoutes');
            
            const reservationsWithRoutes = reservations.map(reservation => {
                const route = routes.find(r => r.route_id == reservation.route_id);
                return { ...reservation, route };
            });
            
            res.json(reservationsWithRoutes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async cancelReservation(req, res) {
        try {
            const { reservationId } = req.params;
            const reservation = await Transportation.cancelReservation(reservationId);
            
            if (!reservation) {
                return res.status(404).json({ error: 'Reservation not found' });
            }

            await Notification.create({
                user_id: req.user.user_id,
                type: 'transport',
                message: 'Your transportation reservation has been cancelled',
                notification_method: 'in-app'
            });

            res.json({ message: 'Reservation cancelled successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = TransportationController;
