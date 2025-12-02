const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

class User {
    static async create(userData) {
        const { email, password, first_name, last_name, phone_number, role, department_id, university_id, subrole } = userData;
        
        // Check if user exists
        const existingByEmail = await query(
            'SELECT user_id FROM users WHERE email = ?',
            [email]
        );
        if (existingByEmail.length > 0) {
            throw new Error('User with this email already exists');
        }
        
        if (university_id) {
            const existingByUniId = await query(
                'SELECT user_id FROM users WHERE university_id = ?',
                [university_id]
            );
            if (existingByUniId.length > 0) {
                throw new Error('User with this University ID already exists');
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with 'pending' status - requires admin approval
        const result = await query(
            `INSERT INTO users (first_name, last_name, email, phone_number, role, subrole, department_id, university_id, password_hash, created_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'pending')`,
            [first_name, last_name, email, phone_number, role || 'student', subrole || null, department_id || null, university_id || null, hashedPassword]
        );

        const userId = result.insertId;
        const user = await this.findById(userId);
        return user;
    }

    static async findByEmail(email, includePassword = false) {
        const users = await query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        const user = users[0];
        if (user && !includePassword) {
            delete user.password_hash;
        }
        return user || null;
    }

    static async findById(userId, includePassword = false) {
        const users = await query(
            'SELECT * FROM users WHERE user_id = ?',
            [userId]
        );
        const user = users[0];
        if (user && !includePassword) {
            delete user.password_hash;
        }
        return user || null;
    }

    static async verifyPassword(user, password) {
        // Get the full user with password_hash
        const userId = user.user_id;
        const fullUser = await query(
            'SELECT password_hash FROM users WHERE user_id = ?',
            [userId]
        );
        if (!fullUser[0]) {
            return false;
        }
        return await bcrypt.compare(password, fullUser[0].password_hash);
    }

    static generateToken(user) {
        return jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    static async update(userId, updates) {
        if (updates.password) {
            updates.password_hash = await bcrypt.hash(updates.password, 10);
            delete updates.password;
        }

        // Build dynamic update query
        const updateFields = [];
        const values = [];
        
        Object.keys(updates).forEach(key => {
            if (key !== 'password' && key !== 'user_id' && updates[key] !== undefined) {
                updateFields.push(`${key} = ?`);
                // Convert undefined to null for SQL
                values.push(updates[key] === undefined ? null : updates[key]);
            }
        });

        if (updateFields.length === 0) {
            return await this.findById(userId);
        }

        values.push(userId);
        await query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
            values
        );

        return await this.findById(userId);
    }
}

module.exports = User;
