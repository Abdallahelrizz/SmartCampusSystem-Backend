const { query } = require('../config/db');
const Notification = require('./Notification');

class Waitlist {
    static async addToWaitlist(userId, resourceId, startTime, endTime) {
        const result = await query(
            `INSERT INTO waitlist (user_id, resource_id, created_at)
             VALUES (?, ?, NOW())`,
            [userId, resourceId]
        );
        
        const waitlistId = result.insertId;
        const waitlistEntry = await query(
            'SELECT * FROM waitlist WHERE waitlist_id = ?',
            [waitlistId]
        );
        return waitlistEntry[0] || null;
    }

    static async getUserWaitlist(userId) {
        return await query(
            'SELECT * FROM waitlist WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }

    static async checkAndNotify(resourceId, startTime, endTime) {
        const matching = await query(
            `SELECT * FROM waitlist 
             WHERE resource_id = ? 
             ORDER BY created_at ASC 
             LIMIT 1`,
            [resourceId]
        );

        if (matching.length > 0) {
            const first = matching[0];
            await Notification.create({
                user_id: first.user_id,
                type: 'booking',
                message: `A resource you were waiting for is now available!`,
                notification_method: 'in-app'
            });
            
            await query(
                'DELETE FROM waitlist WHERE waitlist_id = ?',
                [first.waitlist_id]
            );
            
            return first;
        }
        return null;
    }

    static async removeFromWaitlist(waitlistId) {
        await query(
            'DELETE FROM waitlist WHERE waitlist_id = ?',
            [waitlistId]
        );
        return true;
    }
}

module.exports = Waitlist;
