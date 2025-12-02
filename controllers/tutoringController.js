const { query } = require('../config/db');
const Notification = require('../models/Notification');

class TutoringController {
    static async createSession(req, res) {
        try {
            if (req.user.role !== 'faculty') {
                return res.status(403).json({ error: 'Only faculty can create tutoring sessions' });
            }

            const { course_code, course_name, tutor, room, start_date, day_of_week, time, 
                    duration, start_time, end_time, capacity, description, recurring, frequency } = req.body;
            
            const result = await query(
                `INSERT INTO tutoringsessions 
                 (created_by_user_id, organizer_user_id, course_code, course_name, tutor, room, 
                  start_date, day_of_week, time, duration, start_time, end_time, capacity, 
                  description, recurring, frequency, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [req.user.user_id, req.user.user_id, course_code || null, course_name || null, 
                 tutor || null, room || null, start_date || null, day_of_week || null, 
                 time || null, duration || null, start_time || null, end_time || null, 
                 capacity || null, description || null, recurring || false, frequency || 'weekly']
            );

            const sessionId = result.insertId;
            const session = await query(
                'SELECT * FROM tutoringsessions WHERE session_id = ?',
                [sessionId]
            );

            res.status(201).json({ message: 'Tutoring session created', session: session[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getSessions(req, res) {
        try {
            const sessions = await query('SELECT * FROM tutoringsessions ORDER BY created_at DESC');
            res.json(sessions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async reserveSession(req, res) {
        try {
            const { sessionId } = req.params;
            const session = await query(
                'SELECT * FROM tutoringsessions WHERE session_id = ?',
                [sessionId]
            );
            
            if (!session[0]) {
                return res.status(404).json({ error: 'Session not found' });
            }

            await Notification.create({
                user_id: req.user.user_id,
                type: 'tutoring',
                message: `Tutoring session reserved`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Session reserved' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async deleteSession(req, res) {
        try {
            const { sessionId } = req.params;
            const session = await query(
                'SELECT * FROM tutoringsessions WHERE session_id = ?',
                [sessionId]
            );
            
            if (!session[0]) {
                return res.status(404).json({ error: 'Session not found' });
            }
            
            if (session[0].created_by_user_id != req.user.user_id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized to delete this session' });
            }
            
            await query('DELETE FROM tutoringsessions WHERE session_id = ?', [sessionId]);
            res.json({ message: 'Tutoring session deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = TutoringController;
