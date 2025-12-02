const { query } = require('../config/db');
const Notification = require('../models/Notification');

class PreventiveMaintenanceController {
    static async createTask(req, res) {
        try {
            const { resource_id, maintenance_type, notes, scheduled_date, assigned_to } = req.body;
            
            // Schema has: maintenance_id, resource_id, maintenance_type, scheduled_date, status, notes, assigned_to, completed_at, created_at
            const result = await query(
                `INSERT INTO preventivemaintenance (resource_id, maintenance_type, scheduled_date, status, notes, assigned_to, created_at)
                 VALUES (?, ?, ?, 'pending', ?, ?, NOW())`,
                [resource_id, maintenance_type || null, scheduled_date || new Date(), 
                 notes || null, assigned_to || null]
            );

            const maintenanceId = result.insertId;
            const task = await query(
                'SELECT * FROM preventivemaintenance WHERE maintenance_id = ?',
                [maintenanceId]
            );

            res.status(201).json({ message: 'Preventive maintenance task created', task: task[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getTasks(req, res) {
        try {
            const tasks = await query(
                `SELECT * FROM preventivemaintenance 
                 WHERE assigned_to = ? OR assigned_to IS NULL 
                 ORDER BY due_date ASC`,
                [req.user.user_id]
            );
            res.json(tasks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateTaskStatus(req, res) {
        try {
            const { taskId } = req.params;
            const { status, notes } = req.body;
            
            // Schema uses maintenance_id as primary key, but we'll accept taskId as parameter name for API compatibility
            const task = await query(
                'SELECT * FROM preventivemaintenance WHERE maintenance_id = ?',
                [taskId]
            );
            
            if (!task[0]) {
                return res.status(404).json({ error: 'Task not found' });
            }
            
            const updates = { status };
            if (notes !== undefined) updates.notes = notes;
            if (status === 'completed') {
                updates.completed_at = new Date();
            }
            
            const fields = Object.keys(updates);
            const setClause = fields.map(key => {
                if (key === 'completed_at') {
                    return `${key} = NOW()`;
                }
                return `${key} = ?`;
            }).join(', ');
            const values = fields.filter(key => key !== 'completed_at').map(key => updates[key]);
            values.push(taskId);
            
            await query(
                `UPDATE preventivemaintenance SET ${setClause} WHERE maintenance_id = ?`,
                values
            );
            
            const updated = await query(
                'SELECT * FROM preventivemaintenance WHERE maintenance_id = ?',
                [taskId]
            );
            
            res.json({ message: 'Task status updated', task: updated[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async generateDailySummary(req, res) {
        try {
            const date = req.query.date || new Date().toISOString().split('T')[0];
            
            const issues = await query(
                `SELECT COUNT(*) as count FROM issuereports 
                 WHERE status = 'resolved' AND DATE(resolved_at) = ?`,
                [date]
            );
            const completedRepairs = issues[0].count;
            
            const maintenance = await query(
                `SELECT COUNT(*) as count FROM preventivemaintenance 
                 WHERE status = 'completed' AND DATE(completed_at) = ?`,
                [date]
            );
            const completedMaintenance = maintenance[0].count;
            
            const cleaning = await query(
                `SELECT COUNT(*) as count FROM cleaningtasks 
                 WHERE status = 'completed' AND DATE(completed_at) = ?`,
                [date]
            );
            const completedCleaning = cleaning[0].count;
            
            const pendingIssues = await query(
                `SELECT COUNT(*) as count FROM issuereports WHERE status = 'pending'`
            );
            const pendingCount = pendingIssues[0].count;
            
            const inProgressIssues = await query(
                `SELECT COUNT(*) as count FROM issuereports WHERE status = 'in_progress'`
            );
            const inProgressCount = inProgressIssues[0].count;

            const summary = {
                date,
                completed_repairs: completedRepairs,
                completed_maintenance: completedMaintenance,
                completed_cleaning: completedCleaning,
                pending_issues: pendingCount,
                in_progress_issues: inProgressCount
            };

            res.json(summary);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = PreventiveMaintenanceController;
