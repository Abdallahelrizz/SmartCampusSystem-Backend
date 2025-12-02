const { query } = require('../config/db');

class Event {
    static async create(eventData) {
        const { organizer_user_id, organizer_role, title, description, event_type, location, 
                event_date, start_time, end_time, capacity, available_tickets, ticket_price, status, created_by } = eventData;
        
        const defaultStatus = organizer_role === 'admin' ? 'approved' : 'pending';
        const finalStatus = status || defaultStatus;
        
        // Schema has: event_id, title, description, event_type, location, event_date, start_time, end_time, 
        // capacity, available_tickets, ticket_price, status, created_by, organizer_user_id, organizer_role, 
        // reviewed_by, reviewed_at, created_at
        const result = await query(
            `INSERT INTO events (title, description, event_type, location, event_date, start_time, end_time, 
             capacity, available_tickets, ticket_price, status, created_by, organizer_user_id, organizer_role, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [title, description, event_type || null, location, event_date || null, start_time || null, end_time || null, 
             capacity || null, available_tickets || capacity || null, ticket_price || 0, finalStatus, 
             created_by || null, organizer_user_id || null, organizer_role || null]
        );
        
        const eventId = result.insertId;
        return await this.getById(eventId);
    }

    static async getAll() {
        // Join with users table to get organizer information
        return await query(`
            SELECT e.*, 
                   u.first_name as organizer_first_name,
                   u.last_name as organizer_last_name,
                   u.university_id as organizer_university_id,
                   u.email as organizer_email
            FROM events e
            LEFT JOIN users u ON e.organizer_user_id = u.user_id
            ORDER BY e.created_at DESC
        `);
    }

    static async getById(eventId) {
        // Join with users table to get organizer information
        const results = await query(
            `SELECT e.*, 
                    u.first_name as organizer_first_name,
                    u.last_name as organizer_last_name,
                    u.university_id as organizer_university_id,
                    u.email as organizer_email
             FROM events e
             LEFT JOIN users u ON e.organizer_user_id = u.user_id
             WHERE e.event_id = ?`,
            [eventId]
        );
        return results[0] || null;
    }

    static async reserveTicket(eventId, userId) {
        const event = await this.getById(eventId);
        if (!event) throw new Error('Event not found');

        if (event.status !== 'approved' && event.status !== 'published') {
            throw new Error('This event is not available for ticket reservations');
        }

        // Check capacity
        const reservedTickets = await query(
            `SELECT COUNT(*) as count FROM eventtickets 
             WHERE event_id = ? AND status = 'reserved'`,
            [eventId]
        );
        const reservedCount = reservedTickets[0].count;
        
        if (reservedCount >= event.capacity) {
            throw new Error('Event is full');
        }

        // Check if user already has a ticket
        const existingTicket = await query(
            `SELECT * FROM eventtickets 
             WHERE event_id = ? AND user_id = ? AND status = 'reserved'`,
            [eventId, userId]
        );
        
        if (existingTicket.length > 0) {
            throw new Error('You already have a ticket for this event');
        }

        const result = await query(
            `INSERT INTO eventtickets (event_id, user_id, reserved_at, status)
             VALUES (?, ?, NOW(), 'reserved')`,
            [eventId, userId]
        );
        
        const ticketId = result.insertId;
        const ticket = await query(
            'SELECT * FROM eventtickets WHERE ticket_id = ?',
            [ticketId]
        );
        
        return ticket[0] || null;
    }

    static async getUserTickets(userId) {
        return await query(
            'SELECT * FROM eventtickets WHERE user_id = ? ORDER BY reserved_at DESC',
            [userId]
        );
    }

    static async cancelTicket(ticketId) {
        await query(
            `UPDATE eventtickets SET status = 'cancelled' WHERE ticket_id = ?`,
            [ticketId]
        );
        const result = await query(
            'SELECT * FROM eventtickets WHERE ticket_id = ?',
            [ticketId]
        );
        return result[0] || null;
    }
}

module.exports = Event;
