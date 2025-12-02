const { query } = require('../config/db');

class Issue {
    static async create(issueData) {
        const { reporter_user_id, category, location, description, priority, file_url } = issueData;
        
        const result = await query(
            `INSERT INTO issuereports (reporter_user_id, category, location, description, priority, file_url, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [reporter_user_id, category, location || null, description || null, priority || 'medium', file_url || null]
        );
        
        const issueId = result.insertId;
        
        // Create initial activity
        await this.addActivity(issueId, {
            actor_user_id: reporter_user_id,
            action: 'create',
            note: 'Issue reported'
        });
        
        return await this.getById(issueId);
    }

    static async getAll() {
        return await query('SELECT * FROM issuereports ORDER BY created_at DESC');
    }

    static async getById(issueId) {
        const results = await query(
            'SELECT * FROM issuereports WHERE issue_id = ?',
            [issueId]
        );
        return results[0] || null;
    }

    static async getUserIssues(userId) {
        return await query(
            'SELECT * FROM issuereports WHERE reporter_user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }

    static async updateStatus(issueId, status, assignedUserId = null) {
        const updates = {};
        
        if (assignedUserId) {
            updates.assigned_user_id = assignedUserId;
            updates.assigned_at = new Date();
        }
        
        if (status === 'resolved' || status === 'closed') {
            updates.resolved_at = new Date();
        }
        
        updates.status = status;
        
        const setClause = Object.keys(updates).map(key => {
            if (key === 'assigned_at' || key === 'resolved_at') {
                return `${key} = NOW()`;
            }
            return `${key} = ?`;
        }).join(', ');
        
        const values = Object.values(updates).filter(v => v instanceof Date === false);
        
        if (values.length > 0) {
            await query(
                `UPDATE issuereports SET ${setClause} WHERE issue_id = ?`,
                [...values, issueId]
            );
        }
        
        return await this.getById(issueId);
    }

    static async addActivity(issueId, activityData) {
        const { actor_user_id, action, note } = activityData;
        
        const result = await query(
            `INSERT INTO issueactivities (issue_id, actor_user_id, action, note, time_of_activity)
             VALUES (?, ?, ?, ?, NOW())`,
            [issueId, actor_user_id, action, note || null]
        );
        
        const activityId = result.insertId;
        const activity = await query(
            'SELECT * FROM issueactivities WHERE activity_id = ?',
            [activityId]
        );
        
        return activity[0] || null;
    }

    static async getActivities(issueId) {
        return await query(
            'SELECT * FROM issueactivities WHERE issue_id = ? ORDER BY time_of_activity ASC',
            [issueId]
        );
    }
}

module.exports = Issue;
