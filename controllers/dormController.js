const { query } = require('../config/db');
const Notification = require('../models/Notification');

class DormController {
    static async getAvailableDorms(req, res) {
        try {
            // Use the new availableDorms catalog as the primary source,
            // but still expose the linked dormunits.dorm_id so booking works.
            const dorms = await query(
                `SELECT 
                    ad.available_dorm_id,
                    ad.dorm_id,
                    COALESCE(ad.building, du.building) AS building,
                    COALESCE(ad.unit_number, du.unit_number) AS unit_number,
                    COALESCE(ad.capacity, du.capacity) AS capacity,
                    COALESCE(ad.gender_policy, du.gender_policy) AS gender_policy,
                    COALESCE(ad.price_per_semester, du.price_per_semester) AS price_per_semester,
                    COALESCE(ad.semester, du.semester) AS semester,
                    ad.available_from,
                    ad.available_to,
                    COALESCE(du.status, ad.status) AS status,
                    ad.notes
                 FROM availableDorms ad
                 LEFT JOIN dormUnits du ON ad.dorm_id = du.dorm_id`
            );
            res.json(dorms);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async bookDorm(req, res) {
        try {
            const { dormId, semester } = req.body;
            const dorm = await query(
                'SELECT * FROM dormunits WHERE dorm_id = ?',
                [dormId]
            );
            
            if (!dorm[0]) {
                return res.status(404).json({ error: 'Dorm not found' });
            }

            if (dorm[0].status !== 'available') {
                return res.status(400).json({ error: 'Dorm is not available' });
            }

            // Check if user already has any active dorm reservation (only one dorm per student)
            const existingReservation = await query(
                `SELECT * FROM dormunits 
                 WHERE assigned_user_id = ? AND status = 'occupied'`,
                [req.user.user_id]
            );
            
            if (existingReservation.length > 0) {
                return res.status(400).json({ 
                    error: 'You already have a dorm reservation. Please cancel it before booking a new room.' 
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
                `UPDATE dormunits 
                 SET assigned_user_id = ?, status = 'occupied', start_date = ?, end_date = ?, semester = ?
                 WHERE dorm_id = ?`,
                [req.user.user_id, startDate, endDate, semester, dormId]
            );

            // Mark corresponding catalog entry as filled/unavailable if it exists
            await query(
                `UPDATE availableDorms 
                 SET status = 'filled' 
                 WHERE dorm_id = ?`,
                [dormId]
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
                `SELECT * FROM dormunits 
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
                'SELECT * FROM dormunits WHERE dorm_id = ?',
                [dormId]
            );
            
            if (!dorm[0] || dorm[0].assigned_user_id != req.user.user_id) {
                return res.status(404).json({ error: 'Dorm booking not found' });
            }

            await query(
                `UPDATE dormunits 
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
