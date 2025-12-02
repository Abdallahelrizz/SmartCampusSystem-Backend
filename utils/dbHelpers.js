const { query } = require('../config/db');

// Generic database helper functions to replace DataManager operations

const dbHelpers = {
    // Get all records from a table
    async getAll(tableName, orderBy = 'created_at DESC') {
        return await query(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`);
    },

    // Find by ID
    async findById(tableName, idField, id) {
        const results = await query(
            `SELECT * FROM ${tableName} WHERE ${idField} = ?`,
            [id]
        );
        return results[0] || null;
    },

    // Find by field
    async findByField(tableName, field, value) {
        return await query(
            `SELECT * FROM ${tableName} WHERE ${field} = ?`,
            [value]
        );
    },

    // Find by multiple fields
    async findByFields(tableName, conditions) {
        const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
        const values = Object.values(conditions);
        return await query(
            `SELECT * FROM ${tableName} WHERE ${whereClause}`,
            values
        );
    },

    // Insert record
    async insert(tableName, data) {
        const fields = Object.keys(data).filter(key => data[key] !== undefined);
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(key => data[key]);
        
        const result = await query(
            `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        
        return result.insertId;
    },

    // Update record
    async update(tableName, idField, id, updates) {
        const fields = Object.keys(updates).filter(key => updates[key] !== undefined && key !== idField);
        if (fields.length === 0) {
            return await this.findById(tableName, idField, id);
        }
        
        const setClause = fields.map(key => `${key} = ?`).join(', ');
        const values = fields.map(key => updates[key]);
        values.push(id);
        
        await query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${idField} = ?`,
            values
        );
        
        return await this.findById(tableName, idField, id);
    },

    // Delete record
    async delete(tableName, idField, id) {
        const result = await query(
            `DELETE FROM ${tableName} WHERE ${idField} = ?`,
            [id]
        );
        return result.affectedRows > 0;
    },

    // Get next ID (for compatibility, but AUTO_INCREMENT handles this)
    async getNextId(tableName, idField) {
        const result = await query(`SELECT MAX(${idField}) as maxId FROM ${tableName}`);
        return (result[0]?.maxId || 0) + 1;
    }
};

// Specific helpers for common tables
const resources = {
    async getAll() {
        return await query('SELECT * FROM resources ORDER BY name');
    },
    
    async findById(resourceId) {
        const results = await query('SELECT * FROM resources WHERE resource_id = ?', [resourceId]);
        return results[0] || null;
    },
    
    async updateStatus(resourceId, status, userId = null) {
        if (userId) {
            await query(
                'UPDATE resources SET status = ?, maintenance_set_by = ?, maintenance_set_at = NOW() WHERE resource_id = ?',
                [status, userId, resourceId]
            );
        } else {
            await query('UPDATE resources SET status = ? WHERE resource_id = ?', [status, resourceId]);
        }
        return await this.findById(resourceId);
    }
};

const users = {
    async getAll() {
        return await query('SELECT user_id, first_name, last_name, email, role, department_id, university_id, subrole, phone_number, status, created_at FROM users');
    },
    
    async findByRole(role) {
        return await query(
            'SELECT user_id, first_name, last_name, email, role, department_id, university_id, subrole, phone_number, status FROM users WHERE role = ?',
            [role]
        );
    },
    
    async findById(userId) {
        const results = await query(
            'SELECT user_id, first_name, last_name, email, role, department_id, university_id, subrole, phone_number, status FROM users WHERE user_id = ?',
            [userId]
        );
        return results[0] || null;
    }
};

const departments = {
    async getAll() {
        return await query('SELECT * FROM departments');
    },
    
    async findById(departmentId) {
        const results = await query('SELECT * FROM departments WHERE department_id = ?', [departmentId]);
        return results[0] || null;
    }
};

module.exports = {
    ...dbHelpers,
    resources,
    users,
    departments
};

