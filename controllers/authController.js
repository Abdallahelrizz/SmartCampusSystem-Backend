const User = require('../models/User');
const Notification = require('../models/Notification');
const { query } = require('../config/db');

class AuthController {
    static async signup(req, res) {
        try {
            const { email, password, first_name, last_name, phone_number, role, department_id, university_id, subrole } = req.body;

            // Validate password
            if (!password || password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters' });
            }
            if (!/(?=.*[A-Z])/.test(password)) {
                return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
            }
            if (!/(?=.*[0-9])/.test(password)) {
                return res.status(400).json({ error: 'Password must contain at least one number' });
            }
            if (!/(?=.*[!@#$%^&*])/.test(password)) {
                return res.status(400).json({ error: 'Password must contain at least one special character' });
            }

            // Validate University ID format: exactly 9 digits (year-number format, e.g., 202300000)
            if (university_id) {
                if (!/^\d{9}$/.test(university_id)) {
                    return res.status(400).json({ error: 'University ID must be exactly 9 digits (e.g., 202300000)' });
                }
            }

            const user = await User.create({
                email,
                password,
                first_name,
                last_name,
                phone_number,
                role,
                department_id,
                university_id,
                subrole: role === 'maintenance' ? subrole : null
            });

            // Don't generate token for pending users - they need admin approval first
            // Send notification to admin about new pending user
            const admins = await query('SELECT user_id FROM users WHERE role = ? AND status = ?', ['admin', 'active']);
            for (const admin of admins) {
                await Notification.create({
                    user_id: admin.user_id,
                    type: 'system',
                    message: `New user ${user.first_name} ${user.last_name} (${user.email}) is waiting for approval`,
                    notification_method: 'in-app'
                });
            }

            res.status(201).json({
                message: 'Account created successfully. Your account is pending approval from an administrator. You will be able to log in once your account is approved.',
                user: {
                    user_id: user.user_id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    status: user.status
                }
                // No token - user must wait for approval
            });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findByEmail(email, true); // Include password for verification
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check if user is pending approval
            if (user.status === 'pending') {
                return res.status(403).json({ error: 'Your account is waiting for approval from the administration. Please wait for an administrator to approve your account.' });
            }
            
            // Check if user is suspended or deactivated
            if (user.status !== 'active') {
                return res.status(403).json({ error: 'Account is not active' });
            }

            const isValid = await User.verifyPassword(user, password);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = User.generateToken(user);

            res.json({
                message: 'Login successful',
                user: {
                    user_id: user.user_id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role,
                    department_id: user.department_id,
                    university_id: user.university_id || null,
                    subrole: user.subrole || null
                },
                token
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.user_id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            delete user.password_hash;
            res.json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateProfile(req, res) {
        try {
            const updates = req.body;
            const user = await User.update(req.user.user_id, updates);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            delete user.password_hash;
            res.json({ message: 'Profile updated successfully', user });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = AuthController;

