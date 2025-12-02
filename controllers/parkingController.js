const { query } = require('../config/db');
const Notification = require('../models/Notification');

class ParkingController {
    static async getAvailableSpaces(req, res) {
        try {
            const spaces = await query('SELECT * FROM parkingspaces WHERE status = ?', ['available']);
            res.json(spaces);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async reserveSpace(req, res) {
        try {
            const { spaceId, semester } = req.body;
            const space = await query(
                'SELECT * FROM parkingspaces WHERE parking_space_id = ?',
                [spaceId]
            );
            
            if (!space[0]) {
                return res.status(404).json({ error: 'Parking space not found' });
            }

            if (space[0].status !== 'available') {
                return res.status(400).json({ error: 'Space is not available' });
            }

            // Check if user already has a reservation for this semester
            const existingReservation = await query(
                `SELECT * FROM parkingspaces 
                 WHERE user_id = ? AND semester = ? AND status = 'reserved'`,
                [req.user.user_id, semester]
            );
            
            if (existingReservation.length > 0) {
                return res.status(400).json({ 
                    error: `You already have a parking reservation for the ${semester} semester` 
                });
            }

            // Calculate semester dates
            let startDate, endDate;
            const now = new Date();
            const currentYear = now.getFullYear();
            
            if (semester === 'fall') {
                startDate = new Date(currentYear, 8, 1).toISOString().split('T')[0];
                endDate = new Date(currentYear, 11, 31).toISOString().split('T')[0];
            } else if (semester === 'spring') {
                startDate = new Date(currentYear, 0, 1).toISOString().split('T')[0];
                endDate = new Date(currentYear, 4, 31).toISOString().split('T')[0];
            } else {
                return res.status(400).json({ error: 'Invalid semester. Must be "fall" or "spring"' });
            }

            await query(
                `UPDATE parkingspaces 
                 SET user_id = ?, status = 'reserved', semester = ?, start_date = ?, end_date = ?, reserved_at = NOW()
                 WHERE parking_space_id = ?`,
                [req.user.user_id, semester, startDate, endDate, spaceId]
            );

            await Notification.create({
                user_id: req.user.user_id,
                type: 'parking',
                message: `Parking space ${space[0].spot_number} reserved for ${semester} semester`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Parking space reserved', startDate, endDate });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyReservations(req, res) {
        try {
            const userReservations = await query(
                `SELECT * FROM parkingspaces 
                 WHERE user_id = ? AND status = 'reserved' 
                 ORDER BY reserved_at DESC`,
                [req.user.user_id]
            );
            res.json(userReservations);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyReservation(req, res) {
        try {
            const userReservation = await query(
                `SELECT * FROM parkingspaces 
                 WHERE user_id = ? AND status = 'reserved' 
                 LIMIT 1`,
                [req.user.user_id]
            );
            if (userReservation.length === 0) {
                return res.json(null);
            }
            res.json(userReservation[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async cancelReservation(req, res) {
        try {
            const { spaceId } = req.params;
            const space = await query(
                'SELECT * FROM parkingspaces WHERE parking_space_id = ?',
                [spaceId]
            );
            
            if (!space[0] || space[0].user_id != req.user.user_id) {
                return res.status(404).json({ error: 'Parking reservation not found' });
            }

            await query(
                `UPDATE parkingspaces 
                 SET user_id = NULL, status = 'available', semester = NULL, 
                     start_date = NULL, end_date = NULL, reserved_at = NULL
                 WHERE parking_space_id = ?`,
                [spaceId]
            );

            await Notification.create({
                user_id: req.user.user_id,
                type: 'parking',
                message: `Parking space ${space[0].spot_number} reservation cancelled`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Parking reservation cancelled' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ParkingController;
