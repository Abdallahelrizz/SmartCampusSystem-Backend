const { query } = require('../config/db');

class TransportationAdminController {
    static async createRoute(req, res) {
        try {
            const { route_name, start_location, end_location, capacity, schedule, delays, cancellations } = req.body;
            
            const result = await query(
                `INSERT INTO transportationRoutes (route_name, start_location, end_location, capacity, status, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [route_name, start_location || null, end_location || null, capacity || null, req.body.status || 'active']
            );
            
            const routeId = result.insertId;
            const route = await query(
                'SELECT * FROM transportationRoutes WHERE route_id = ?',
                [routeId]
            );

            res.status(201).json({ message: 'Route created', route: route[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateRoute(req, res) {
        try {
            const { routeId } = req.params;
            const route = await query(
                'SELECT * FROM transportationRoutes WHERE route_id = ?',
                [routeId]
            );
            
            if (!route[0]) {
                return res.status(404).json({ error: 'Route not found' });
            }
            
            const fields = Object.keys(req.body).filter(key => req.body[key] !== undefined && key !== 'route_id');
            if (fields.length === 0) {
                return res.json({ message: 'No changes', route: route[0] });
            }
            
            const setClause = fields.map(key => `${key} = ?`).join(', ');
            const values = fields.map(key => req.body[key]);
            values.push(routeId);
            
            await query(
                `UPDATE transportationRoutes SET ${setClause} WHERE route_id = ?`,
                values
            );
            
            const updated = await query(
                'SELECT * FROM transportationRoutes WHERE route_id = ?',
                [routeId]
            );
            
            res.json({ message: 'Route updated', route: updated[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async deleteRoute(req, res) {
        try {
            const { routeId } = req.params;
            const route = await query(
                'SELECT * FROM transportationRoutes WHERE route_id = ?',
                [routeId]
            );
            
            if (!route[0]) {
                return res.status(404).json({ error: 'Route not found' });
            }
            
            await query('DELETE FROM transportationRoutes WHERE route_id = ?', [routeId]);
            res.json({ message: 'Route deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateSchedule(req, res) {
        try {
            const { routeId } = req.params;
            const { schedule, delays, cancellations } = req.body;
            
            const route = await query(
                'SELECT * FROM transportationRoutes WHERE route_id = ?',
                [routeId]
            );
            
            if (!route[0]) {
                return res.status(404).json({ error: 'Route not found' });
            }
            
            const updates = {};
            if (schedule !== undefined) updates.schedule = schedule;
            if (delays !== undefined) updates.delays = delays;
            if (cancellations !== undefined) updates.cancellations = cancellations;
            
            const fields = Object.keys(updates);
            if (fields.length === 0) {
                return res.json({ message: 'No changes', route: route[0] });
            }
            
            const setClause = fields.map(key => `${key} = ?`).join(', ');
            const values = fields.map(key => updates[key]);
            values.push(routeId);
            
            await query(
                `UPDATE transportationRoutes SET ${setClause} WHERE route_id = ?`,
                values
            );
            
            const updated = await query(
                'SELECT * FROM transportationRoutes WHERE route_id = ?',
                [routeId]
            );
            
            res.json({ message: 'Schedule updated', route: updated[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = TransportationAdminController;
