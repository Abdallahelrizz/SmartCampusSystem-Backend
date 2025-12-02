const { query } = require('../config/db');
const Notification = require('../models/Notification');
const { users } = require('../utils/dbHelpers');

class ClassroomChangeController {
    static async requestChange(req, res) {
        try {
            const { current_classroom, new_classroom, current_room, requested_room, 
                    course_code, reason, details, issue_id } = req.body;
            
            const result = await query(
                `INSERT INTO classroomchangerequests 
                 (faculty_user_id, current_classroom, new_classroom, course_code, reason, details, issue_id, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
                [req.user.user_id, 
                 current_classroom || current_room || null, 
                 new_classroom || requested_room || null,
                 course_code || null, reason || null, details || null, issue_id || null]
            );
            
            const requestId = result.insertId;
            const request = await query(
                'SELECT * FROM classroomchangerequests WHERE request_id = ?',
                [requestId]
            );

            // Notify admins
            const admins = await users.findByRole('admin');
            for (const admin of admins) {
                await Notification.create({
                    user_id: admin.user_id,
                    type: 'admin',
                    message: `Classroom change request from ${req.user.email}`,
                    notification_method: 'in-app'
                });
            }

            res.status(201).json({ message: 'Classroom change request submitted', request: request[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyRequests(req, res) {
        try {
            const requests = await query(
                'SELECT * FROM classroomchangerequests WHERE faculty_user_id = ? ORDER BY created_at DESC',
                [req.user.user_id]
            );
            res.json(requests);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getPendingRequests(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can view pending requests' });
            }

            const requests = await query(
                'SELECT * FROM classroomchangerequests WHERE status = ? ORDER BY created_at ASC',
                ['pending']
            );
            const allUsers = await users.getAll();
            
            const pendingRequests = requests.map(reqItem => {
                const faculty = allUsers.find(u => u.user_id == reqItem.faculty_user_id);
                return {
                    ...reqItem,
                    faculty: faculty ? {
                        user_id: faculty.user_id,
                        email: faculty.email,
                        first_name: faculty.first_name,
                        last_name: faculty.last_name
                    } : null
                };
            });

            res.json(pendingRequests);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async approveRequest(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can approve requests' });
            }

            const { requestId } = req.params;
            const request = await query(
                'SELECT * FROM classroomchangerequests WHERE request_id = ?',
                [requestId]
            );
            
            if (!request[0]) {
                return res.status(404).json({ error: 'Request not found' });
            }

            if (request[0].status !== 'pending') {
                return res.status(400).json({ error: 'Request is not pending' });
            }

            await query(
                `UPDATE classroomchangerequests 
                 SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
                 WHERE request_id = ?`,
                [req.user.user_id, requestId]
            );

            await Notification.create({
                user_id: request[0].faculty_user_id,
                type: 'admin',
                message: `Your classroom change request (${request[0].current_classroom || 'Current'} → ${request[0].new_classroom || 'New'}) has been approved.`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Classroom change request approved successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async rejectRequest(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can reject requests' });
            }

            const { requestId } = req.params;
            const { reason } = req.body;
            const request = await query(
                'SELECT * FROM classroomchangerequests WHERE request_id = ?',
                [requestId]
            );
            
            if (!request[0]) {
                return res.status(404).json({ error: 'Request not found' });
            }

            if (request[0].status !== 'pending') {
                return res.status(400).json({ error: 'Request is not pending' });
            }

            await query(
                `UPDATE classroomchangerequests 
                 SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
                 WHERE request_id = ?`,
                [req.user.user_id, requestId]
            );

            await Notification.create({
                user_id: request[0].faculty_user_id,
                type: 'admin',
                message: `Your classroom change request (${request[0].current_classroom || 'Current'} → ${request[0].new_classroom || 'New'}) has been rejected.${reason ? ' Reason: ' + reason : ''}`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Classroom change request rejected successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ClassroomChangeController;
