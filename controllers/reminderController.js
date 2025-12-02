const { query } = require('../config/db');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking');

class ReminderController {
    static async checkAndSendReminders() {
        // Auto-update expired bookings first
        await Booking.updateExpiredBookings();
        
        const bookings = await Booking.getAll();
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        for (const booking of bookings) {
            // Only send reminders for bookings that are currently active (time-based)
            if (Booking.isCurrentlyActive(booking) || 
                (booking.status === 'active' && booking.start_time && new Date(booking.start_time) > now)) {
                if (!booking.start_time) continue;
                
                const bookingTime = new Date(booking.start_time);
                const timeDiff = bookingTime - now;
                
                // Check if booking is within 1 hour and reminder not sent
                if (timeDiff > 0 && timeDiff <= 60 * 60 * 1000 && !booking.reminder_sent) {
                    await Notification.create({
                        user_id: booking.user_id,
                        type: 'booking',
                        message: `Reminder: Your booking starts in 1 hour at ${new Date(booking.start_time).toLocaleString()}`,
                        notification_method: 'in-app'
                    });
                    
                    // Mark reminder as sent (if column exists)
                    try {
                        await query(
                            'UPDATE bookings SET reminder_sent = 1 WHERE booking_id = ?',
                            [booking.booking_id]
                        );
                    } catch (error) {
                        // Column might not exist, ignore
                    }
                }
            }
        }
    }
}

module.exports = ReminderController;
