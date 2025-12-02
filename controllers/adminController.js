const Booking = require('../models/Booking');
const { query } = require('../config/db');
const Notification = require('../models/Notification');
const User = require('../models/User');
const EmailService = require('../utils/emailService');
const { resources, users } = require('../utils/dbHelpers');

class AdminController {
    static async getPendingBookings(req, res) {
        try {
            const requests = await Booking.getAllRequests();
            const pending = requests.filter(r => r.status === 'pending');
            
            const requestsWithDetails = await Promise.all(pending.map(async (reqItem) => {
                const resource = await resources.findById(reqItem.resource_id);
                const user = await users.findById(reqItem.user_id);
                return {
                    ...reqItem,
                    resource,
                    user: user ? {
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name
                    } : null
                };
            }));

            res.json(requestsWithDetails);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async approveBooking(req, res) {
        try {
            const { requestId } = req.params;
            const booking = await Booking.approveRequest(requestId, req.user.user_id);

            if (booking) {
                const user = await User.findById(booking.user_id);
                const resource = await resources.findById(booking.resource_id);
                
                await Notification.create({
                    user_id: booking.user_id,
                    type: 'booking',
                    message: 'Your booking request has been approved',
                    notification_method: 'in-app'
                });
                
                // Send email notification
                if (user && user.email) {
                    EmailService.sendBookingConfirmation(user.email, {
                        resource_name: resource?.name || 'Resource',
                        start_time: booking.start_time,
                        end_time: booking.end_time
                    });
                }
                
                res.json({ message: 'Booking approved', booking });
            } else {
                res.status(404).json({ error: 'Request not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async rejectBooking(req, res) {
        try {
            const { requestId } = req.params;
            const request = await Booking.rejectRequest(requestId, req.user.user_id);

            if (request) {
                await Notification.create({
                    user_id: request.user_id,
                    type: 'booking',
                    message: 'Your booking request has been rejected',
                    notification_method: 'in-app'
                });
                res.json({ message: 'Booking rejected' });
            } else {
                res.status(404).json({ error: 'Request not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllUsers(req, res) {
        try {
            const allUsers = await users.getAll();
            res.json(allUsers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getPendingUsers(req, res) {
        try {
            const pendingUsers = await query(
                'SELECT user_id, first_name, last_name, email, phone_number, role, subrole, department_id, university_id, created_at FROM users WHERE status = ? ORDER BY created_at DESC',
                ['pending']
            );
            res.json(pendingUsers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async approveUser(req, res) {
        try {
            const { userId } = req.params;
            const { first_name, last_name, email, phone_number, role, subrole, department_id, university_id } = req.body;
            
            // Get current user
            const currentUser = await User.findById(userId);
            if (!currentUser) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            if (currentUser.status !== 'pending') {
                return res.status(400).json({ error: 'User is not pending approval' });
            }
            
            // Build update data with provided fields (admin can modify everything)
            const updateData = {
                status: 'active'
            };
            
            // Update fields if provided, otherwise keep existing values
            if (first_name !== undefined) updateData.first_name = first_name;
            if (last_name !== undefined) updateData.last_name = last_name;
            if (email !== undefined) updateData.email = email;
            if (phone_number !== undefined) updateData.phone_number = phone_number;
            if (role !== undefined) updateData.role = role;
            if (department_id !== undefined) updateData.department_id = department_id || null;
            if (university_id !== undefined) updateData.university_id = university_id || null;
            
            // Handle subrole based on role
            if (role !== undefined) {
                if (role === 'maintenance') {
                    updateData.subrole = (subrole && subrole.trim() !== '') ? subrole.trim() : 'it_support';
                } else {
                    updateData.subrole = null;
                }
            } else if (subrole !== undefined) {
                // If only subrole is being updated and user is maintenance
                if (currentUser.role === 'maintenance') {
                    updateData.subrole = (subrole && subrole.trim() !== '') ? subrole.trim() : 'it_support';
                }
            }
            
            // Check for email uniqueness if email is being changed
            if (email && email !== currentUser.email) {
                const existingUser = await query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, userId]);
                if (existingUser.length > 0) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
            }
            
            // Check for university_id uniqueness if university_id is being changed
            if (university_id && university_id !== currentUser.university_id) {
                const existingUser = await query('SELECT user_id FROM users WHERE university_id = ? AND user_id != ?', [university_id, userId]);
                if (existingUser.length > 0) {
                    return res.status(400).json({ error: 'University ID already exists' });
                }
            }
            
            // Update user
            const updatedUser = await User.update(userId, updateData);
            
            // Send notification to user
            await Notification.create({
                user_id: userId,
                type: 'system',
                message: 'Your account has been approved! You can now log in to the Smart Campus System.',
                notification_method: 'in-app'
            });
            
            res.json({ message: 'User approved successfully', user: updatedUser });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async rejectUser(req, res) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            
            const currentUser = await User.findById(userId);
            if (!currentUser) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            if (currentUser.status !== 'pending') {
                return res.status(400).json({ error: 'User is not pending approval' });
            }
            
            // Delete the user (or set status to rejected if you want to keep records)
            await query('DELETE FROM users WHERE user_id = ?', [userId]);
            
            res.json({ message: 'User registration rejected and removed' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { status } = req.body;
            const user = await User.update(userId, { status });
            res.json({ message: 'User status updated', user });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateUserRole(req, res) {
        try {
            const { userId } = req.params;
            const { role, subrole } = req.body;
            
            // Get current user to check if role is changing
            const currentUser = await User.findById(userId);
            if (!currentUser) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const updateData = {};
            
            // If only subrole is being updated (role is undefined), handle subrole update for maintenance users
            if (role === undefined && subrole !== undefined) {
                // Only updating subrole - user must be maintenance
                if (currentUser.role !== 'maintenance') {
                    return res.status(400).json({ error: 'Subrole can only be set for maintenance users' });
                }
                // Update subrole (convert empty string to null, but maintenance should always have a subrole)
                if (subrole && subrole.trim() !== '') {
                    updateData.subrole = subrole.trim();
                } else {
                    // Default to 'it_support' if empty
                    updateData.subrole = 'it_support';
                }
            } else if (role !== undefined) {
                // Role is being changed
                updateData.role = role;
                
                // Handle subrole based on role change
                if (role === 'maintenance') {
                    // If changing to maintenance, always set a default subrole
                    // Use provided subrole if valid, otherwise default to 'it_support'
                    if (subrole && subrole.trim() !== '') {
                        updateData.subrole = subrole.trim();
                    } else if (currentUser.subrole && currentUser.subrole.trim() !== '') {
                        // Keep existing subrole if user already has one
                        updateData.subrole = currentUser.subrole.trim();
                    } else {
                        // Default to 'it_support' if no subrole is set
                        updateData.subrole = 'it_support';
                    }
                } else if (currentUser.role === 'maintenance' && role !== 'maintenance') {
                    // If changing from maintenance to another role, set subrole to null
                    updateData.subrole = null;
                } else if (role !== 'maintenance') {
                    // For non-maintenance roles, ensure subrole is null
                    updateData.subrole = null;
                }
            }
            
            // Ensure no undefined values in updateData
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });
            
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }
            
            const user = await User.update(userId, updateData);
            res.json({ message: 'User role updated', user });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async reassignIssue(req, res) {
        try {
            const { issueId } = req.params;
            const { user_id } = req.body;
            const Issue = require('../models/Issue');
            const issue = await Issue.updateStatus(issueId, 'in_progress', user_id);
            
            await Issue.addActivity(issueId, {
                actor_user_id: req.user.user_id,
                action: 'reassign',
                note: `Issue reassigned by admin to user ${user_id}`
            });

            res.json({ message: 'Issue reassigned', issue });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateResourceStatus(req, res) {
        try {
            const { resourceId } = req.params;
            const { status } = req.body;
            const resource = await resources.updateStatus(resourceId, status, req.user.user_id);
            res.json({ message: 'Resource status updated', resource });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async createResource(req, res) {
        try {
            const { name, resource_type, building, capacity } = req.body;
            const resourceData = {
                name,
                resource_type,
                building,
                capacity: parseInt(capacity) || null,
                status: 'active',
                created_at: new Date()
            };
            
            const resourceId = await query(
                `INSERT INTO resources (name, resource_type, building, capacity, status)
                 VALUES (?, ?, ?, ?, ?)`,
                [name, resource_type, building || null, resourceData.capacity, 'active']
            );
            
            const newResource = await resources.findById(resourceId.insertId);
            res.status(201).json({ message: 'Resource created', resource: newResource });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async broadcastNotification(req, res) {
        try {
            const { message } = req.body;
            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'Message cannot be empty' });
            }

            const allUsers = await query(
                'SELECT user_id, role, status FROM users WHERE status = ?',
                ['active']
            );
            
            const activeUsers = allUsers;
            const students = activeUsers.filter(u => u.role === 'student');
            const facultyUsers = activeUsers.filter(u => u.role === 'faculty');
            const maintenanceUsers = activeUsers.filter(u => u.role === 'maintenance');
            const admins = activeUsers.filter(u => u.role === 'admin');
            
            // Create an announcement
            // Schema has: announcement_id, title, message, content, priority, created_by, created_by_user_id, created_at, status
            const announcementResult = await query(
                `INSERT INTO announcements (created_by_user_id, title, message, content, priority, created_at)
                 VALUES (?, 'Campus-Wide Message', ?, ?, 'normal', NOW())`,
                [req.user.user_id, message.trim(), message.trim()]
            );
            
            const announcementId = announcementResult.insertId;
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            // Create notifications for all active users
            for (const user of activeUsers) {
                try {
                    await Notification.create({
                        user_id: user.user_id,
                        type: 'admin',
                        message: message.trim(),
                        notification_method: 'in-app'
                    });
                    successCount++;
                } catch (err) {
                    console.error(`Failed to create notification for user ${user.user_id} (${user.role}):`, err);
                    errorCount++;
                    errors.push({ user_id: user.user_id, role: user.role, error: err.message });
                }
            }

            const roleBreakdown = {
                student: { total: students.length, sent: students.length },
                faculty: { total: facultyUsers.length, sent: facultyUsers.length },
                maintenance: { total: maintenanceUsers.length, sent: maintenanceUsers.length },
                admin: { total: admins.length, sent: admins.length }
            };

            console.log(`Broadcast notification sent to ${successCount} users. Breakdown:`, roleBreakdown);

            res.json({ 
                message: 'Notification broadcasted successfully', 
                total: activeUsers.length,
                success: successCount,
                errors: errorCount,
                breakdown: roleBreakdown,
                announcement_id: announcementId,
                errorDetails: errors.length > 0 ? errors : undefined
            });
        } catch (error) {
            console.error('Error broadcasting notification:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async getActivityLogs(req, res) {
        try {
            // Get activity from various tables
            const bookings = await query('SELECT booking_id, user_id, created_at FROM bookings');
            const issues = await query('SELECT issue_id, reporter_user_id as user_id, created_at FROM issuereports');
            const events = await query('SELECT event_id, organizer_user_id as user_id, created_at FROM events');
            // Schema has: log_id, user_id, action, resource, ip_address, timestamp
            // Filter by action containing 'FAILED' to get failed login attempts
            const accessLogs = await query(
                "SELECT user_id, timestamp, resource as endpoint, action FROM accesslogs WHERE action LIKE '%FAILED%'"
            );

            const logs = [
                ...bookings.map(b => ({ 
                    type: 'booking', 
                    action: 'created', 
                    timestamp: b.created_at, 
                    id: b.booking_id, 
                    user_id: b.user_id 
                })),
                ...issues.map(i => ({ 
                    type: 'issue', 
                    action: 'reported', 
                    timestamp: i.created_at, 
                    id: i.issue_id, 
                    user_id: i.user_id 
                })),
                ...events.map(e => ({ 
                    type: 'event', 
                    action: 'created', 
                    timestamp: e.created_at, 
                    id: e.event_id, 
                    user_id: e.user_id 
                })),
                ...accessLogs.map(l => ({ 
                    type: 'security', 
                    action: 'failed_login', 
                    timestamp: l.timestamp, 
                    user_id: l.user_id, 
                    endpoint: l.endpoint 
                }))
            ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            res.json(logs);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getSuspiciousActivity(req, res) {
        try {
            // Schema has: log_id, user_id, action, resource, ip_address, timestamp
            // Get failed login attempts by checking action field and resource field
            const accessLogs = await query(
                "SELECT * FROM accesslogs WHERE action LIKE '%FAILED%' AND resource LIKE ?",
                ['%login%']
            );
            
            // Get user emails by joining with users table
            const logsWithUsers = await Promise.all(accessLogs.map(async (log) => {
                if (log.user_id) {
                    const user = await query('SELECT email FROM users WHERE user_id = ?', [log.user_id]);
                    return { ...log, email: user[0]?.email || null };
                }
                return { ...log, email: null };
            }));
            
            // Find users with multiple failed login attempts
            const suspicious = {};
            
            logsWithUsers.forEach(log => {
                if (log.email) {
                    if (!suspicious[log.email]) {
                        suspicious[log.email] = { 
                            email: log.email, 
                            count: 0, 
                            last_attempt: log.timestamp 
                        };
                    }
                    suspicious[log.email].count++;
                    if (new Date(log.timestamp) > new Date(suspicious[log.email].last_attempt)) {
                        suspicious[log.email].last_attempt = log.timestamp;
                    }
                }
            });

            const suspiciousList = Object.values(suspicious).filter(s => s.count >= 3);
            res.json(suspiciousList);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = AdminController;
