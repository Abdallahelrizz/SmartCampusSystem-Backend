const { query } = require('../config/db');
const Notification = require('../models/Notification');

class LostFoundController {
    static async reportItem(req, res) {
        try {
            const { item_name, description, location_found, location_lost, status } = req.body;
            
            // Schema fields: item_id, user_id, item_name, description, location_found, location_lost, status, created_at
            const result = await query(
                `INSERT INTO lostFound 
                 (user_id, item_name, description, location_found, location_lost, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [req.user.user_id, item_name || null, description || null, location_found || null, 
                 location_lost || null, status || 'found']
            );

            const itemId = result.insertId;
            const item = await query(
                'SELECT * FROM lostFound WHERE item_id = ?',
                [itemId]
            );

            res.status(201).json({ message: 'Item reported', item: item[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getItems(req, res) {
        try {
            // Schema has created_at, not reported_at
            const items = await query('SELECT * FROM lostFound ORDER BY created_at DESC');
            res.json(items);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async claimItem(req, res) {
        try {
            const { itemId } = req.params;
            const item = await query(
                'SELECT * FROM lostFound WHERE item_id = ?',
                [itemId]
            );
            
            if (!item[0]) {
                return res.status(404).json({ error: 'Item not found' });
            }

            // Schema has: item_id, user_id, item_name, description, location_found, location_lost, status, created_at
            // No claimed_by_user_id or claimed_at fields - just update status
            await query(
                `UPDATE lostFound 
                 SET status = 'claimed'
                 WHERE item_id = ?`,
                [itemId]
            );

            // Notify the user who reported the item (if different from claimer)
            if (item[0].user_id && item[0].user_id != req.user.user_id) {
                await Notification.create({
                    user_id: item[0].user_id,
                    type: 'system',
                    message: 'Your reported lost item has been claimed',
                    notification_method: 'in-app'
                });
            }

            res.json({ message: 'Item claimed' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = LostFoundController;
