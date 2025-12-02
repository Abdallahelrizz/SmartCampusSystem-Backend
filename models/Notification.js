const { query } = require('../config/db');

class Notification {
    static async create(notificationData) {
        const { user_id, type, message, notification_method } = notificationData;
        const result = await query(
            `INSERT INTO notifications (user_id, \`type\`, message, notification_method, sent_at, \`read\`)
             VALUES (?, ?, ?, ?, NOW(), 0)`,
            [user_id, type, message, notification_method || 'in-app']
        );
        return { notification_id: result.insertId, ...notificationData, sent_at: new Date(), read: false };
    }

    static async getUserNotifications(userId, unreadOnly = false) {
        let sql = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [userId];
        
        if (unreadOnly) {
            sql += ' AND `read` = 0';
        }
        
        sql += ' ORDER BY sent_at DESC';
        
        return await query(sql, params);
    }

    static async markAsRead(notificationId) {
        await query(
            'UPDATE notifications SET `read` = 1 WHERE notification_id = ?',
            [notificationId]
        );
        const result = await query(
            'SELECT * FROM notifications WHERE notification_id = ?',
            [notificationId]
        );
        return result[0] || null;
    }

    static async markAllAsRead(userId) {
        await query(
            'UPDATE notifications SET `read` = 1 WHERE user_id = ? AND `read` = 0',
            [userId]
        );
        return true;
    }
}

module.exports = Notification;
