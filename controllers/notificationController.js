const Notification = require('../models/Notification');
const { query } = require('../config/db');

class NotificationController {
    static async getNotifications(req, res) {
        try {
            const { unread } = req.query;
            const notifications = await Notification.getUserNotifications(
                req.user.user_id,
                unread === 'true'
            );
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async markAsRead(req, res) {
        try {
            const { notificationId } = req.params;
            await Notification.markAsRead(notificationId);
            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async markAllAsRead(req, res) {
        try {
            await Notification.markAllAsRead(req.user.user_id);
            res.json({ message: 'All notifications marked as read' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllNotifications(req, res) {
        try {
            const notifications = await query('SELECT * FROM notifications ORDER BY sent_at DESC');
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = NotificationController;
