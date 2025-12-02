const NursingAppointment = require('../models/NursingAppointment');

class NursingController {
    static async getAvailableSlots(req, res) {
        try {
            const { date } = req.query;
            const slots = await NursingAppointment.getAvailableSlots(date);
            res.json(slots);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async bookAppointment(req, res) {
        try {
            const { appointment_time, reason, notes } = req.body;
            const appointment_date = appointment_time ? appointment_time.split('T')[0] : null;
            
            const appointment = await NursingAppointment.create({
                user_id: req.user.user_id,
                appointment_date: appointment_time || appointment_date,
                notes: reason || notes || 'General consultation'
            });
            
            res.status(201).json({ message: 'Appointment booked successfully', appointment });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMyAppointments(req, res) {
        try {
            const appointments = await NursingAppointment.getUserAppointments(req.user.user_id);
            res.json(appointments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async cancelAppointment(req, res) {
        try {
            const { appointmentId } = req.params;
            await NursingAppointment.cancel(appointmentId);
            res.json({ message: 'Appointment cancelled' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = NursingController;
