const { query } = require('../config/db');
const Waitlist = require('./Waitlist');

class Booking {
    static async createRequest(requestData) {
        const { user_id, resource_id, start_time, end_time, purpose, priority } = requestData;
        const result = await query(
            `INSERT INTO bookingrequests (user_id, resource_id, start_time, end_time, purpose, priority, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [user_id, resource_id, start_time || null, end_time || null, purpose || null, priority || null]
        );
        
        const requestId = result.insertId;
        const request = await this.getRequestById(requestId);
        return request;
    }

    static async getAllRequests() {
        return await query('SELECT * FROM bookingrequests ORDER BY created_at DESC');
    }

    static async getRequestById(requestId) {
        const results = await query(
            'SELECT * FROM bookingrequests WHERE request_id = ?',
            [requestId]
        );
        return results[0] || null;
    }

    static async getUserRequests(userId) {
        return await query(
            'SELECT * FROM bookingrequests WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }

    static async approveRequest(requestId, adminId) {
        const request = await this.getRequestById(requestId);
        if (!request) return null;

        // Update request status
        await query(
            `UPDATE bookingrequests SET status = 'approved', reviewed_by_admin_id = ?, reviewed_at = NOW() 
             WHERE request_id = ?`,
            [adminId, requestId]
        );

        // Create booking
        const result = await query(
            `INSERT INTO bookings (request_id, resource_id, user_id, start_time, end_time, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
            [requestId, request.resource_id, request.user_id, request.start_time, request.end_time]
        );
        
        const bookingId = result.insertId;
        const booking = await query(
            'SELECT * FROM bookings WHERE booking_id = ?',
            [bookingId]
        );
        
        return booking[0] || null;
    }

    static async rejectRequest(requestId, adminId) {
        await query(
            `UPDATE bookingrequests SET status = 'rejected', reviewed_by_admin_id = ?, reviewed_at = NOW() 
             WHERE request_id = ?`,
            [adminId, requestId]
        );
        return await this.getRequestById(requestId);
    }

    static isCurrentlyActive(booking) {
        if (!booking || booking.status !== 'active') return false;
        const now = new Date();
        const startTime = booking.start_time ? new Date(booking.start_time) : null;
        const endTime = booking.end_time ? new Date(booking.end_time) : null;
        if (!startTime || !endTime) return false;
        return now >= startTime && now <= endTime;
    }

    static async updateExpiredBookings() {
        const result = await query(
            `UPDATE bookings 
             SET status = 'completed', completed_at = NOW() 
             WHERE status = 'active' 
             AND end_time IS NOT NULL 
             AND end_time < NOW()`
        );
        return result.affectedRows;
    }

    static async getUserBookings(userId) {
        await this.updateExpiredBookings();
        return await query(
            'SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }

    static async getAll() {
        await this.updateExpiredBookings();
        return await query('SELECT * FROM bookings ORDER BY created_at DESC');
    }

    static async cancelBooking(bookingId) {
        const booking = await query(
            'SELECT * FROM bookings WHERE booking_id = ?',
            [bookingId]
        );
        
        if (!booking[0]) return null;
        
        await query(
            `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE booking_id = ?`,
            [bookingId]
        );
        
        // Check waitlist when booking is cancelled
        if (booking[0]) {
            await Waitlist.checkAndNotify(booking[0].resource_id, booking[0].start_time, booking[0].end_time);
        }
        
        const updated = await query(
            'SELECT * FROM bookings WHERE booking_id = ?',
            [bookingId]
        );
        
        return updated[0] || null;
    }

    static async checkAvailability(resourceId, startTime, endTime) {
        const now = new Date();
        const requestedStart = new Date(startTime);
        const requestedEnd = new Date(endTime);
        
        const bookings = await query(
            `SELECT * FROM bookings 
             WHERE resource_id = ? 
             AND status = 'active' 
             AND start_time IS NOT NULL 
             AND end_time IS NOT NULL
             AND end_time > ?`,
            [resourceId, now]
        );
        
        return !bookings.some(b => {
            const bookingStart = new Date(b.start_time);
            const bookingEnd = new Date(b.end_time);
            
            // Check for time overlap
            return (requestedStart >= bookingStart && requestedStart < bookingEnd) ||
                   (requestedEnd > bookingStart && requestedEnd <= bookingEnd) ||
                   (requestedStart <= bookingStart && requestedEnd >= bookingEnd);
        });
    }
}

module.exports = Booking;
