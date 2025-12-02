// Simulated Email Service (for prototype)
// In production, this would integrate with SMTP or email service like SendGrid, AWS SES, etc.

class EmailService {
    static async sendEmail(to, subject, message) {
        // Simulate email sending
        console.log(`[EMAIL] To: ${to}`);
        console.log(`[EMAIL] Subject: ${subject}`);
        console.log(`[EMAIL] Message: ${message}`);
        
        // In production, this would be:
        // const nodemailer = require('nodemailer');
        // await transporter.sendMail({ to, subject, text: message });
        
        // For prototype, we'll also create a notification
        const Notification = require('../models/Notification');
        const { query } = require('../config/db');
        const users = await query('SELECT user_id FROM users WHERE email = ?', [to]);
        
        if (users.length > 0) {
            await Notification.create({
                user_id: users[0].user_id,
                type: 'system',
                message: `Email: ${subject}`,
                notification_method: 'email'
            });
        }
        
        return { success: true, message: 'Email sent (simulated)' };
    }

    static async sendPasswordReset(to, resetToken) {
        const resetLink = `http://localhost:3001/reset-password?token=${resetToken}`;
        return this.sendEmail(
            to,
            'Password Reset - Smart Campus System',
            `Click this link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`
        );
    }

    static async sendBookingConfirmation(to, bookingDetails) {
        return this.sendEmail(
            to,
            'Booking Confirmation - Smart Campus System',
            `Your booking has been confirmed:\n\nResource: ${bookingDetails.resource_name}\nTime: ${bookingDetails.start_time} - ${bookingDetails.end_time}\n\nThank you!`
        );
    }

    static async sendReminder(to, bookingDetails) {
        return this.sendEmail(
            to,
            'Booking Reminder - Smart Campus System',
            `Reminder: Your booking starts in 1 hour:\n\nResource: ${bookingDetails.resource_name}\nTime: ${bookingDetails.start_time} - ${bookingDetails.end_time}`
        );
    }
}

module.exports = EmailService;

