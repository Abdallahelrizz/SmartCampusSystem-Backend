const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { users } = require('../utils/dbHelpers');

class EventController {
    static async createEvent(req, res) {
        try {
            if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only faculty and admin can create events' });
            }

            const event = await Event.create({
                organizer_user_id: req.user.user_id,
                organizer_role: req.user.role,
                ...req.body
            });

            // Notify admins if created by faculty (needs approval)
            if (req.user.role === 'faculty') {
                const admins = await users.findByRole('admin');
                for (const admin of admins) {
                    await Notification.create({
                        user_id: admin.user_id,
                        type: 'admin',
                        message: `New event "${req.body.title || 'Untitled Event'}" requires approval from ${req.user.email}`,
                        notification_method: 'in-app'
                    });
                }
            }

            res.status(201).json({ message: req.user.role === 'faculty' ? 'Event created and pending approval' : 'Event created successfully', event });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllEvents(req, res) {
        try {
            const { department_id } = req.query;
            let events = await Event.getAll();
            
            // For students and general users, only show approved events
            // For faculty and admin, show all events (including pending)
            if (req.user.role === 'student' || !req.user.role) {
                events = events.filter(e => e.status === 'approved' || e.status === 'published');
            }
            
            // Filter by department if provided
            if (department_id) {
                const allUsers = await users.getAll();
                events = events.filter(e => {
                    const organizer = allUsers.find(u => u.user_id == e.organizer_user_id);
                    return organizer && organizer.department_id == department_id;
                });
            }
            
            res.json(events);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getEventById(req, res) {
        try {
            const { eventId } = req.params;
            const event = await Event.getById(eventId);
            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }
            res.json(event);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async reserveTicket(req, res) {
        try {
            const { eventId } = req.params;
            const ticket = await Event.reserveTicket(eventId, req.user.user_id);

            await Notification.create({
                user_id: req.user.user_id,
                type: 'event',
                message: `You have reserved a ticket for event #${eventId}`,
                notification_method: 'in-app'
            });

            res.status(201).json({ message: 'Ticket reserved successfully', ticket });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async getMyTickets(req, res) {
        try {
            const tickets = await Event.getUserTickets(req.user.user_id);
            const allEvents = await Event.getAll();
            const ticketsWithEvents = tickets.map(ticket => {
                const event = allEvents.find(e => e.event_id == ticket.event_id);
                return { ...ticket, event };
            });
            res.json(ticketsWithEvents);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async cancelTicket(req, res) {
        try {
            const { ticketId } = req.params;
            const tickets = await Event.getUserTickets(req.user.user_id);
            const ticket = tickets.find(t => t.ticket_id == ticketId);
            
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            await Event.cancelTicket(ticketId);
            res.json({ message: 'Ticket cancelled successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateEvent(req, res) {
        try {
            const { eventId } = req.params;
            const event = await Event.getById(eventId);
            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }
            if (event.organizer_user_id != req.user.user_id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized to edit this event' });
            }
            
            // If faculty edits an event, set status back to pending for admin approval
            const updateData = { ...req.body };
            if (req.user.role === 'faculty' && event.status === 'approved') {
                updateData.status = 'pending';
            }
            
            const { query, update } = require('../utils/dbHelpers');
            const updated = await update('events', 'event_id', eventId, updateData);
            const updatedEvent = await Event.getById(eventId);
            res.json({ message: 'Event updated', event: updatedEvent });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async deleteEvent(req, res) {
        try {
            const { eventId } = req.params;
            const event = await Event.getById(eventId);
            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }
            if (event.organizer_user_id != req.user.user_id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized to delete this event' });
            }

            // Cancel all tickets for this event
            const { query } = require('../config/db');
            const eventTickets = await query(
                'SELECT * FROM eventTickets WHERE event_id = ? AND status = ?',
                [eventId, 'reserved']
            );
            
            // Cancel all tickets and notify students
            const notifiedUsers = new Set();
            for (const ticket of eventTickets) {
                await Event.cancelTicket(ticket.ticket_id);
                
                if (!notifiedUsers.has(ticket.user_id)) {
                    await Notification.create({
                        user_id: ticket.user_id,
                        type: 'event',
                        message: `Event "${event.title || 'Event #' + eventId}" has been cancelled. Your ticket has been refunded.`,
                        notification_method: 'in-app'
                    });
                    notifiedUsers.add(ticket.user_id);
                }
            }

            // Delete the event
            await query('DELETE FROM events WHERE event_id = ?', [eventId]);
            
            res.json({ 
                message: 'Event deleted', 
                cancelledTickets: eventTickets.length,
                notifiedUsers: notifiedUsers.size
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getPendingEvents(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can view pending events' });
            }

            const allEvents = await Event.getAll();
            const allUsers = await users.getAll();
            
            const pendingEvents = allEvents
                .filter(e => e.status === 'pending')
                .map(event => {
                    const organizer = allUsers.find(u => u.user_id == event.organizer_user_id);
                    return {
                        ...event,
                        organizer: organizer ? {
                            user_id: organizer.user_id,
                            email: organizer.email,
                            first_name: organizer.first_name,
                            last_name: organizer.last_name
                        } : null
                    };
                })
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            res.json(pendingEvents);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async approveEvent(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can approve events' });
            }

            const { eventId } = req.params;
            const event = await Event.getById(eventId);
            
            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }

            if (event.status !== 'pending') {
                return res.status(400).json({ error: 'Event is not pending approval' });
            }

            // Update event status to approved
            const { update } = require('../utils/dbHelpers');
            await update('events', 'event_id', eventId, {
                status: 'approved',
                reviewed_by: req.user.user_id,
                reviewed_at: new Date()
            });

            // Notify faculty organizer
            await Notification.create({
                user_id: event.organizer_user_id,
                type: 'event',
                message: `Your event "${event.title || 'Event #' + eventId}" has been approved and is now visible to students.`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Event approved successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async rejectEvent(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can reject events' });
            }

            const { eventId } = req.params;
            const { reason } = req.body;
            const event = await Event.getById(eventId);
            
            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }

            if (event.status !== 'pending') {
                return res.status(400).json({ error: 'Event is not pending approval' });
            }

            // Note: rejection_reason field may not exist in schema, so we'll just update status
            const { update } = require('../utils/dbHelpers');
            await update('events', 'event_id', eventId, {
                status: 'rejected',
                reviewed_by: req.user.user_id,
                reviewed_at: new Date()
            });

            // Notify faculty organizer
            await Notification.create({
                user_id: event.organizer_user_id,
                type: 'event',
                message: `Your event "${event.title || 'Event #' + eventId}" has been rejected.${reason ? ' Reason: ' + reason : ''}`,
                notification_method: 'in-app'
            });

            res.json({ message: 'Event rejected successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = EventController;

