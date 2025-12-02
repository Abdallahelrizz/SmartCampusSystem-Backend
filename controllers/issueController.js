const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const { users } = require('../utils/dbHelpers');

class IssueController {
    static async createIssue(req, res) {
        try {
            let { category, location, description, priority } = req.body;
            const userId = req.user.user_id;

            // Auto-categorize if not provided or enhance category
            if (!category || category === 'general') {
                const desc = description.toLowerCase();
                if (desc.includes('network') || desc.includes('internet') || desc.includes('wifi') || desc.includes('computer') || desc.includes('software')) {
                    category = 'IT';
                } else if (desc.includes('air') || desc.includes('temperature') || desc.includes('ventilation') || desc.includes('noise')) {
                    category = 'environmental';
                } else if (desc.includes('broken') || desc.includes('repair') || desc.includes('fix') || desc.includes('damage') || desc.includes('cleaning') || desc.includes('clean')) {
                    category = 'cleaning';
                } else {
                    category = category || 'general';
                }
            }

            // Auto-determine priority based on keywords
            if (!priority || priority === 'medium') {
                const desc = description.toLowerCase();
                if (desc.includes('urgent') || desc.includes('emergency') || desc.includes('critical') || desc.includes('immediate')) {
                    priority = 'high';
                } else if (desc.includes('minor') || desc.includes('small')) {
                    priority = 'low';
                } else {
                    priority = priority || 'medium';
                }
            }

            const issue = await Issue.create({
                reporter_user_id: userId,
                category,
                location,
                description,
                priority: priority || 'medium',
                file_url: req.file ? `/api/uploads/${req.file.filename}` : null
            });

            // Notify maintenance staff
            const maintenanceStaff = await users.findByRole('maintenance');
            const EmailService = require('../utils/emailService');
            
            for (const staff of maintenanceStaff) {
                await Notification.create({
                    user_id: staff.user_id,
                    type: 'issue',
                    message: `New ${category} issue reported at ${location}`,
                    notification_method: 'in-app'
                });
                
                // Send email notification for urgent issues
                if (priority === 'high' || priority === 'critical') {
                    if (staff.email) {
                        EmailService.sendEmail(
                            staff.email,
                            `Urgent ${category} Issue Reported`,
                            `A ${priority} priority ${category} issue has been reported at ${location}.\n\nDescription: ${description}`
                        );
                    }
                }
            }

            res.status(201).json({ message: 'Issue reported successfully', issue });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyIssues(req, res) {
        try {
            const issues = await Issue.getUserIssues(req.user.user_id);
            res.json(issues);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllIssues(req, res) {
        try {
            const issues = await Issue.getAll();
            res.json(issues);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getIssueById(req, res) {
        try {
            const { issueId } = req.params;
            const issue = await Issue.getById(issueId);
            if (!issue) {
                return res.status(404).json({ error: 'Issue not found' });
            }
            const activities = await Issue.getActivities(issueId);
            res.json({ ...issue, activities });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateIssueStatus(req, res) {
        try {
            const { issueId } = req.params;
            const { status, note } = req.body;
            const userId = req.user.user_id;

            const issue = await Issue.getById(issueId);
            if (!issue) {
                return res.status(404).json({ error: 'Issue not found' });
            }

            // Update status
            const updatedIssue = await Issue.updateStatus(issueId, status, userId);

            // Add activity
            await Issue.addActivity(issueId, {
                actor_user_id: userId,
                action: 'update',
                note: note || `Status changed to ${status}`
            });

            // Notify reporter
            if (status === 'resolved' || status === 'closed') {
                const EmailService = require('../utils/emailService');
                const reporter = await users.findById(issue.reporter_user_id);
                
                await Notification.create({
                    user_id: issue.reporter_user_id,
                    type: 'issue',
                    message: `Your issue #${issueId} has been ${status}`,
                    notification_method: 'in-app'
                });
                
                // Send email notification
                if (reporter && reporter.email) {
                    EmailService.sendEmail(
                        reporter.email,
                        `Issue #${issueId} ${status}`,
                        `Your issue report #${issueId} has been ${status}.\n\nLocation: ${issue.location}\nCategory: ${issue.category}`
                    );
                }
            }

            res.json({ message: 'Issue status updated', issue: updatedIssue });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getIssueActivities(req, res) {
        try {
            const { issueId } = req.params;
            const activities = await Issue.getActivities(issueId);
            res.json(activities);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async addIssueActivity(req, res) {
        try {
            const { issueId } = req.params;
            const { note, action } = req.body;
            const userId = req.user.user_id;

            await Issue.addActivity(issueId, {
                actor_user_id: userId,
                action: action || 'add_note',
                note: note
            });

            res.json({ message: 'Activity added successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async cancelIssue(req, res) {
        try {
            const { issueId } = req.params;
            const issue = await Issue.getById(issueId);
            
            if (!issue) {
                return res.status(404).json({ error: 'Issue not found' });
            }

            // Only allow users to cancel their own pending issues
            if (issue.reporter_user_id != req.user.user_id) {
                return res.status(403).json({ error: 'You can only cancel your own issues' });
            }

            if (issue.status !== 'pending') {
                return res.status(400).json({ error: 'Only pending issues can be cancelled' });
            }

            // Update status to cancelled
            await Issue.updateStatus(issueId, 'cancelled', req.user.user_id);
            
            // Add activity
            await Issue.addActivity(issueId, {
                actor_user_id: req.user.user_id,
                action: 'cancel',
                note: 'Issue cancelled by reporter'
            });

            res.json({ message: 'Issue cancelled successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = IssueController;

