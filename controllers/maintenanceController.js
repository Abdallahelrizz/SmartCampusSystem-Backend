const Issue = require('../models/Issue');
const { query } = require('../config/db');
const { resources } = require('../utils/dbHelpers');

class MaintenanceController {
    static async getAssignedIssues(req, res) {
        try {
            const issues = await Issue.getAll();
            const assigned = issues.filter(i => 
                i.assigned_user_id == req.user.user_id || i.status === 'pending'
            );
            res.json(assigned);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async assignIssue(req, res) {
        try {
            const { issueId } = req.params;
            const issue = await Issue.updateStatus(issueId, 'in_progress', req.user.user_id);

            await Issue.addActivity(issueId, {
                actor_user_id: req.user.user_id,
                action: 'assign',
                note: 'Issue assigned to maintenance staff'
            });

            res.json({ message: 'Issue assigned', issue });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateFacilityStatus(req, res) {
        try {
            const { resourceId, status } = req.body;
            
            if (status === 'under_maintenance') {
                await query(
                    `UPDATE resources SET status = ?, maintenance_set_by = ?, maintenance_set_at = NOW()
                     WHERE resource_id = ?`,
                    [status, req.user.user_id, resourceId]
                );
            } else if (status === 'active') {
                await query(
                    `UPDATE resources SET status = ?, maintenance_set_by = NULL, maintenance_set_at = NULL
                     WHERE resource_id = ?`,
                    [status, resourceId]
                );
            } else {
                await query(
                    'UPDATE resources SET status = ? WHERE resource_id = ?',
                    [status, resourceId]
                );
            }
            
            const resource = await resources.findById(resourceId);
            res.json({ message: 'Facility status updated', resource });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getCleaningTasks(req, res) {
        try {
            const tasks = await query('SELECT * FROM cleaningTasks ORDER BY created_at DESC');
            const allTasks = await Promise.all(tasks.map(async (t) => {
                const resource = await resources.findById(t.resource_id);
                return { ...t, resource };
            }));
            res.json(allTasks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async completeCleaningTask(req, res) {
        try {
            const { taskId } = req.params;
            const task = await query(
                'SELECT * FROM cleaningTasks WHERE task_id = ?',
                [taskId]
            );
            
            if (!task[0]) {
                return res.status(404).json({ error: 'Task not found' });
            }
            
            await query(
                'UPDATE cleaningTasks SET status = ?, completed_at = NOW() WHERE task_id = ?',
                ['completed', taskId]
            );
            
            const updated = await query(
                'SELECT * FROM cleaningTasks WHERE task_id = ?',
                [taskId]
            );
            
            res.json({ message: 'Task completed', task: updated[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateChecklistItem(req, res) {
        try {
            const { taskId } = req.params;
            const { itemIndex, completed } = req.body;
            const task = await query(
                'SELECT * FROM cleaningTasks WHERE task_id = ?',
                [taskId]
            );
            
            if (!task[0]) {
                return res.status(404).json({ error: 'Task not found' });
            }
            
            // Get checklist items
            // Schema has: checklist_id, task_id, task, completed (no item_index field)
            const checklistItems = await query(
                'SELECT * FROM cleaningTaskChecklist WHERE task_id = ? ORDER BY checklist_id',
                [taskId]
            );
            
            // Update the specific item
            // Schema has: checklist_id (primary key), task_id, task, completed
            if (checklistItems[itemIndex]) {
                await query(
                    'UPDATE cleaningTaskChecklist SET completed = ? WHERE checklist_id = ?',
                    [completed ? 1 : 0, checklistItems[itemIndex].checklist_id]
                );
            }
            
            // Check if all items are completed
            const updatedItems = await query(
                'SELECT * FROM cleaningTaskChecklist WHERE task_id = ?',
                [taskId]
            );
            const allCompleted = updatedItems.length > 0 && updatedItems.every(item => item.completed === 1);
            
            if (allCompleted && task[0].status !== 'completed') {
                await query(
                    'UPDATE cleaningTasks SET status = ?, completed_at = NOW() WHERE task_id = ?',
                    ['completed', taskId]
                );
            }
            
            const updated = await query(
                'SELECT * FROM cleaningTasks WHERE task_id = ?',
                [taskId]
            );
            
            res.json({ message: 'Checklist updated', task: updated[0] });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = MaintenanceController;
