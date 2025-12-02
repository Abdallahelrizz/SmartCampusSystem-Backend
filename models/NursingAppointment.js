const { query } = require('../config/db');
const Notification = require('./Notification');

class NursingAppointment {
    static async create(appointmentData) {
        const { user_id, appointment_date, notes } = appointmentData;
        
        const result = await query(
            `INSERT INTO nursingAppointments (user_id, appointment_date, status, notes, created_at)
             VALUES (?, ?, 'scheduled', ?, NOW())`,
            [user_id, appointment_date, notes || null]
        );
        
        const appointmentId = result.insertId;
        const appointment = await query(
            'SELECT * FROM nursingAppointments WHERE appointment_id = ?',
            [appointmentId]
        );
        
        await Notification.create({
            user_id: user_id,
            type: 'system',
            message: `Nursing appointment scheduled for ${appointment_date}`,
            notification_method: 'in-app'
        });
        
        return appointment[0] || null;
    }

    static async getUserAppointments(userId) {
        return await query(
            'SELECT * FROM nursingAppointments WHERE user_id = ? ORDER BY appointment_date DESC',
            [userId]
        );
    }

    static async getAvailableSlots(date) {
        // Generate available time slots (9 AM - 5 PM, every hour)
        const slots = [];
        for (let hour = 9; hour < 17; hour++) {
            slots.push({
                time: `${hour.toString().padStart(2, '0')}:00`,
                available: true
            });
        }
        return slots;
    }

    static async cancel(appointmentId) {
        await query(
            `UPDATE nursingAppointments SET status = 'cancelled' WHERE appointment_id = ?`,
            [appointmentId]
        );
        const result = await query(
            'SELECT * FROM nursingAppointments WHERE appointment_id = ?',
            [appointmentId]
        );
        return result[0] || null;
    }
}

module.exports = NursingAppointment;
