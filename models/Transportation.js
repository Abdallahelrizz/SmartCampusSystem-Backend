const { query } = require('../config/db');

class Transportation {
    static async reserveSeat(routeId, userId, date, time) {
        const route = await query(
            'SELECT * FROM transportationRoutes WHERE route_id = ?',
            [routeId]
        );
        if (!route[0]) throw new Error('Route not found');

        // Check if user already has a reservation
        const existingReservation = await query(
            `SELECT * FROM transportationReservations 
             WHERE route_id = ? AND user_id = ? AND date = ? AND time = ? AND status = 'reserved'`,
            [routeId, userId, date, time]
        );

        if (existingReservation.length > 0) {
            throw new Error('You already have a reservation for this route at this time');
        }

        // Count active reservations
        const activeReservations = await query(
            `SELECT COUNT(*) as count FROM transportationReservations 
             WHERE route_id = ? AND date = ? AND time = ? AND status = 'reserved'`,
            [routeId, date, time]
        );
        
        if (activeReservations[0].count >= route[0].capacity) {
            throw new Error('This route is full for the selected time');
        }

        // Create reservation
        const result = await query(
            `INSERT INTO transportationReservations (route_id, user_id, date, time, reserved_at, status)
             VALUES (?, ?, ?, ?, NOW(), 'reserved')`,
            [routeId, userId, date, time]
        );
        
        const reservationId = result.insertId;
        const reservation = await query(
            'SELECT * FROM transportationReservations WHERE reservation_id = ?',
            [reservationId]
        );
        
        return reservation[0] || null;
    }

    static async getUserReservations(userId) {
        return await query(
            `SELECT * FROM transportationReservations 
             WHERE user_id = ? AND status = 'reserved' 
             ORDER BY date DESC, time DESC`,
            [userId]
        );
    }

    static async cancelReservation(reservationId) {
        await query(
            `UPDATE transportationReservations SET status = 'cancelled' WHERE reservation_id = ?`,
            [reservationId]
        );
        const result = await query(
            'SELECT * FROM transportationReservations WHERE reservation_id = ?',
            [reservationId]
        );
        return result[0] || null;
    }

    static isCurrentlyActive(reservation) {
        if (!reservation || reservation.status !== 'reserved') return false;
        const now = new Date();
        const reservationDate = new Date(reservation.date);
        const reservationTime = reservation.time.split(':');
        const reservationDateTime = new Date(reservationDate);
        reservationDateTime.setHours(parseInt(reservationTime[0]), parseInt(reservationTime[1]), 0, 0);
        return now <= reservationDateTime;
    }

    static async updateExpiredReservations() {
        // This is complex to do in SQL, so we'll handle it differently
        // For now, reservations stay as 'reserved' until manually cancelled
        return 0;
    }
}

module.exports = Transportation;

