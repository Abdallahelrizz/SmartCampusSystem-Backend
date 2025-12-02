const { query } = require('../config/db');

class SystemConfigController {
    static async getConfig(req, res) {
        try {
            const configs = await query('SELECT * FROM systemConfig LIMIT 1');
            
            if (configs.length === 0) {
                // Initialize default config
                await query(
                    `INSERT INTO systemConfig 
                     (booking_time_limit_hours, cancellation_policy_hours, buffer_period_minutes, 
                      max_bookings_per_user, reminder_time_before_hours)
                     VALUES (24, 2, 15, 5, 1)`
                );
                const newConfig = await query('SELECT * FROM systemConfig LIMIT 1');
                return res.json(newConfig[0] || {});
            }
            
            res.json(configs[0] || {});
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateConfig(req, res) {
        try {
            const configs = await query('SELECT * FROM systemConfig LIMIT 1');
            
            const fields = Object.keys(req.body).filter(key => req.body[key] !== undefined);
            if (fields.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }
            
            if (configs.length === 0) {
                // Create new config
                const values = fields.map(key => req.body[key]);
                const placeholders = fields.map(() => '?').join(', ');
                await query(
                    `INSERT INTO systemConfig (${fields.join(', ')}) VALUES (${placeholders})`,
                    values
                );
            } else {
                // Update existing config
                const setClause = fields.map(key => `${key} = ?`).join(', ');
                const values = fields.map(key => req.body[key]);
                await query(
                    `UPDATE systemConfig SET ${setClause} LIMIT 1`,
                    values
                );
            }
            
            const updated = await query('SELECT * FROM systemConfig LIMIT 1');
            res.json({ message: 'Configuration updated', config: updated[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = SystemConfigController;
