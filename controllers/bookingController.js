const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const { resources, users } = require('../utils/dbHelpers');
const Notification = require('../models/Notification');
const User = require('../models/User');

class BookingController {
    static async createRequest(req, res) {
        try {
            const { resource_id, start_time, end_time, purpose } = req.body;
            const userId = req.user.user_id;

            // Check if resource exists and is available (not under maintenance or closed)
            const resource = await resources.findById(resource_id);
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' });
            }
            if (resource.status === 'under_maintenance' || resource.status === 'closed') {
                return res.status(400).json({ 
                    error: `Resource is ${resource.status === 'under_maintenance' ? 'under maintenance' : 'closed'} and cannot be booked`
                });
            }

            // Check availability
            const isAvailable = await Booking.checkAvailability(resource_id, start_time, end_time);
            if (!isAvailable) {
                // Offer waitlist option
                return res.status(400).json({ 
                    error: 'Resource is not available at this time',
                    waitlist_available: true,
                    message: 'Would you like to be added to the waitlist?'
                });
            }

            const request = await Booking.createRequest({
                user_id: userId,
                resource_id,
                start_time,
                end_time,
                purpose: purpose || 'General use',
                priority: req.user.role === 'faculty' ? 'faculty' : 'student'
            });

            // Auto-approve the booking request (for immediate availability)
            const booking = await Booking.approveRequest(request.request_id, req.user.user_id);
            
            // Notify user
            await Notification.create({
                user_id: userId,
                type: 'booking',
                message: 'Your booking has been confirmed',
                notification_method: 'in-app'
            });

            // Notify admin (optional - for tracking)
            const admins = await users.findByRole('admin');
            for (const admin of admins) {
                await Notification.create({
                    user_id: admin.user_id,
                    type: 'booking',
                    message: `New booking from ${req.user.email} (auto-approved)`,
                    notification_method: 'in-app'
                });
            }

            res.status(201).json({ message: 'Booking confirmed successfully', booking });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyRequests(req, res) {
        try {
            const requests = await Booking.getUserRequests(req.user.user_id);
            const requestsWithResources = await Promise.all(requests.map(async (reqItem) => {
                const resource = await resources.findById(reqItem.resource_id);
                return { ...reqItem, resource };
            }));
            res.json(requestsWithResources);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyBookings(req, res) {
        try {
            const bookings = await Booking.getUserBookings(req.user.user_id);
            const bookingsWithResources = await Promise.all(bookings.map(async (booking) => {
                const resource = await resources.findById(booking.resource_id);
                return { ...booking, resource };
            }));
            res.json(bookingsWithResources);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async cancelBooking(req, res) {
        try {
            const { bookingId } = req.params;
            const booking = await Booking.cancelBooking(bookingId);
            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }

            const EmailService = require('../utils/emailService');
            await Notification.create({
                user_id: booking.user_id,
                type: 'booking',
                message: 'Your booking has been cancelled',
                notification_method: 'in-app'
            });
            
            // Send email notification
            const user = await User.findById(booking.user_id);
            if (user) {
                EmailService.sendEmail(user.email, 'Booking Cancelled', `Your booking has been cancelled.`);
            }

            res.json({ message: 'Booking cancelled successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAvailableResources(req, res) {
        try {
            const { resource_type, building, date } = req.query;
            let allResources = await resources.getAll();

            if (resource_type) {
                allResources = allResources.filter(r => r.resource_type === resource_type);
            }
            if (building) {
                allResources = allResources.filter(r => r.building === building);
            }

            // Filter by availability if date provided
            if (date) {
                await Booking.updateExpiredBookings();
                const bookings = await Booking.getAll();
                allResources = allResources.map(resource => {
                    // Check for time-based active bookings on this date
                    const isBooked = bookings.some(b => {
                        if (b.resource_id != resource.resource_id || b.status !== 'active') {
                            return false;
                        }
                        // Check if booking is currently active and overlaps with the requested date
                        const isActive = Booking.isCurrentlyActive(b);
                        if (!b.start_time) return false;
                        const bookingDate = b.start_time.split('T')[0];
                        return isActive && bookingDate === date;
                    });
                    return { ...resource, available: !isBooked };
                });
            }

            res.json(allResources);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async addToWaitlist(req, res) {
        try {
            const { resource_id, start_time, end_time } = req.body;
            const waitlistEntry = await Waitlist.addToWaitlist(req.user.user_id, resource_id, start_time, end_time);
            
            await Notification.create({
                user_id: req.user.user_id,
                type: 'booking',
                message: 'You have been added to the waitlist. You will be notified when the resource becomes available.',
                notification_method: 'in-app'
            });

            res.status(201).json({ message: 'Added to waitlist', waitlistEntry });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyWaitlist(req, res) {
        try {
            const waitlist = await Waitlist.getUserWaitlist(req.user.user_id);
            const waitlistWithResources = await Promise.all(waitlist.map(async (w) => {
                const resource = await resources.findById(w.resource_id);
                return { ...w, resource };
            }));
            res.json(waitlistWithResources);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAllBookings(req, res) {
        try {
            // Only faculty and admin can see all bookings
            if (req.user.role !== 'faculty' && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized' });
            }
            const bookings = await Booking.getAll();
            const bookingsWithDetails = await Promise.all(bookings.map(async (booking) => {
                const resource = await resources.findById(booking.resource_id);
                const user = await users.findById(booking.user_id);
                return { ...booking, resource, user };
            }));
            res.json(bookingsWithDetails);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = BookingController;

