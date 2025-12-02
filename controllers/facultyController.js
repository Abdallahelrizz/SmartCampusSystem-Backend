const { query } = require('../config/db');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const { users, resources } = require('../utils/dbHelpers');

class FacultyController {
    static async createAnnouncement(req, res) {
        try {
            const { title, message, content, priority } = req.body;
            // Schema has: announcement_id, title, message, content, priority, created_by, created_by_user_id, created_at, status
            // Use content if provided, otherwise use message
            const announcementContent = content || message || null;
            
            const result = await query(
                `INSERT INTO announcements (created_by_user_id, title, message, content, priority, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [req.user.user_id, title || null, message || null, announcementContent, priority || 'normal']
            );

            const announcementId = result.insertId;
            const announcement = await query(
                'SELECT * FROM announcements WHERE announcement_id = ?',
                [announcementId]
            );

            // Notify all students
            const students = await users.findByRole('student');
            for (const student of students) {
                await Notification.create({
                    user_id: student.user_id,
                    type: 'admin',
                    message: `New announcement: ${title || 'Announcement'}`,
                    notification_method: 'in-app'
                });
            }

            res.status(201).json({ message: 'Announcement created', announcement: announcement[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAnnouncements(req, res) {
        try {
            const announcements = await query(
                'SELECT * FROM announcements ORDER BY created_at DESC'
            );
            res.json(announcements);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateAnnouncement(req, res) {
        try {
            const { announcementId } = req.params;
            const announcement = await query(
                'SELECT * FROM announcements WHERE announcement_id = ?',
                [announcementId]
            );
            
            if (!announcement[0] || announcement[0].created_by_user_id != req.user.user_id) {
                return res.status(403).json({ error: 'Not authorized to edit this announcement' });
            }
            
            const fields = Object.keys(req.body).filter(key => req.body[key] !== undefined);
            if (fields.length === 0) {
                return res.json({ message: 'No changes', announcement: announcement[0] });
            }
            
            const setClause = fields.map(key => `${key} = ?`).join(', ');
            const values = fields.map(key => req.body[key]);
            values.push(announcementId);
            
            await query(
                `UPDATE announcements SET ${setClause} WHERE announcement_id = ?`,
                values
            );
            
            const updated = await query(
                'SELECT * FROM announcements WHERE announcement_id = ?',
                [announcementId]
            );
            
            res.json({ message: 'Announcement updated', announcement: updated[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async deleteAnnouncement(req, res) {
        try {
            const { announcementId } = req.params;
            const announcement = await query(
                'SELECT * FROM announcements WHERE announcement_id = ?',
                [announcementId]
            );
            
            if (!announcement[0] || 
                (announcement[0].created_by_user_id != req.user.user_id && req.user.role !== 'admin')) {
                return res.status(403).json({ error: 'Not authorized to delete this announcement' });
            }
            
            await query('DELETE FROM announcements WHERE announcement_id = ?', [announcementId]);
            res.json({ message: 'Announcement deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getCourses(req, res) {
        try {
            const courses = await query('SELECT * FROM courses ORDER BY course_code');
            res.json(courses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async overrideBooking(req, res) {
        try {
            const { bookingId } = req.params;
            const booking = await query(
                'SELECT * FROM bookings WHERE booking_id = ?',
                [bookingId]
            );
            
            if (!booking[0]) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            const resource = await resources.findById(booking[0].resource_id);
            const resourceName = resource ? resource.name : 'Resource';

            // Cancel student booking
            await Booking.cancelBooking(bookingId);

            // Create new booking for faculty
            const result = await query(
                `INSERT INTO bookings (resource_id, user_id, start_time, end_time, status, created_at)
                 VALUES (?, ?, ?, ?, 'active', NOW())`,
                [booking[0].resource_id, req.user.user_id, booking[0].start_time, booking[0].end_time]
            );

            const newBookingId = result.insertId;
            const newBooking = await query(
                'SELECT * FROM bookings WHERE booking_id = ?',
                [newBookingId]
            );

            // Create notification for student
            await Notification.create({
                user_id: booking[0].user_id,
                type: 'booking',
                message: `Your booking for ${resourceName} has been cancelled due to faculty override`,
                notification_method: 'in-app'
            });

            // Create announcement for the student
            const announcementMessage = `Your booking for ${resourceName} (${new Date(booking[0].start_time).toLocaleString()} - ${new Date(booking[0].end_time).toLocaleString()}) has been cancelled due to faculty academic requirements.`;
            const announcementResult = await query(
                `INSERT INTO announcements (created_by_user_id, title, message, content, priority, created_at)
                 VALUES (?, ?, ?, ?, 'high', NOW())`,
                [
                    req.user.user_id,
                    'Booking Cancelled',
                    announcementMessage,
                    announcementMessage
                ]
            );

            await Notification.create({
                user_id: booking[0].user_id,
                type: 'admin',
                message: `Important: Your booking has been cancelled - Booking Cancelled`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Booking overridden', booking: newBooking[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = FacultyController;
