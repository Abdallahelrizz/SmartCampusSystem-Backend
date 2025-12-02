const { query } = require('../config/db');
const Notification = require('../models/Notification');

class DormController {
    static async getAvailableDorms(req, res) {
        try {
            const dorms = await query('SELECT * FROM dormUnits WHERE status = ?', ['available']);
            res.json(dorms);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async bookDorm(req, res) {
        try {
            const { dormId, semester } = req.body;
            const dorm = await query(
                'SELECT * FROM dormUnits WHERE dorm_id = ?',
                [dormId]
            );
            
            if (!dorm[0]) {
                return res.status(404).json({ error: 'Dorm not found' });
            }

            if (dorm[0].status !== 'available') {
                return res.status(400).json({ error: 'Dorm is not available' });
            }

            // Check if user already has a reservation for this semester
            const existingReservation = await query(
                `SELECT * FROM dormUnits 
                 WHERE assigned_user_id = ? AND semester = ? AND status = 'occupied'`,
                [req.user.user_id, semester]
            );
            
            if (existingReservation.length > 0) {
                return res.status(400).json({ 
                    error: `You already have a dorm reservation for the ${semester} semester` 
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
                `UPDATE dormUnits 
                 SET assigned_user_id = ?, status = 'occupied', start_date = ?, end_date = ?, semester = ?
                 WHERE dorm_id = ?`,
                [req.user.user_id, startDate, endDate, semester, dormId]
            );

            await Notification.create({
                user_id: req.user.user_id,
                type: 'dorm',
                message: `Dorm ${dorm[0].unit_number} booked successfully for ${semester} semester`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Dorm booked successfully', startDate, endDate });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyReservation(req, res) {
        try {
            const userDorm = await query(
                `SELECT * FROM dormUnits 
                 WHERE assigned_user_id = ? AND status = 'occupied' 
                 LIMIT 1`,
                [req.user.user_id]
            );
            if (userDorm.length === 0) {
                return res.json(null);
            }
            res.json(userDorm[0]);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async cancelDorm(req, res) {
        try {
            const { dormId } = req.params;
            const dorm = await query(
                'SELECT * FROM dormUnits WHERE dorm_id = ?',
                [dormId]
            );
            
            if (!dorm[0] || dorm[0].assigned_user_id != req.user.user_id) {
                return res.status(404).json({ error: 'Dorm booking not found' });
            }

            await query(
                `UPDATE dormUnits 
                 SET assigned_user_id = NULL, status = 'available', 
                     start_date = NULL, end_date = NULL, semester = NULL
                 WHERE dorm_id = ?`,
                [dormId]
            );

            res.json({ message: 'Dorm booking cancelled' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = DormController;
