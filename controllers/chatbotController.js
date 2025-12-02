class ChatbotController {
    static async getResponse(req, res) {
        try {
            const { message } = req.body;
            const lowerMessage = message.toLowerCase();

            // Simple rule-based chatbot
            let response = "I'm here to help! How can I assist you with campus services?";

            if (lowerMessage.includes('booking') || lowerMessage.includes('book')) {
                response = "To book a resource, go to the Bookings section and select an available room, lab, or facility. You can filter by type, building, or date.";
            } else if (lowerMessage.includes('issue') || lowerMessage.includes('report') || lowerMessage.includes('problem')) {
                response = "To report an issue, go to the Issue Reporting section. Provide the category, location, and description. You can also attach photos.";
            } else if (lowerMessage.includes('event') || lowerMessage.includes('ticket')) {
                response = "You can view and reserve tickets for campus events in the Events section. Faculty members can create new events.";
            } else if (lowerMessage.includes('transport') || lowerMessage.includes('bus') || lowerMessage.includes('shuttle')) {
                response = "Transportation services are available in the Transportation section. You can view routes and reserve seats for campus shuttles or university buses.";
            } else if (lowerMessage.includes('dorm') || lowerMessage.includes('housing')) {
                response = "Dorm booking is available in the Housing section. You can view available units and book them for a semester.";
            } else if (lowerMessage.includes('parking')) {
                response = "Parking spaces can be reserved in the Parking section. Check availability and reserve a spot.";
            } else if (lowerMessage.includes('tutoring')) {
                response = "Tutoring sessions are organized by faculty members. Check the Tutoring section for available sessions.";
            } else if (lowerMessage.includes('job') || lowerMessage.includes('employment')) {
                response = "Student employment opportunities are listed in the Employment section. You can view jobs and submit applications.";
            } else if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
                response = "Campus facilities typically operate from 8 AM to 8 PM. Library hours may vary. Check specific facility pages for detailed hours.";
            } else if (lowerMessage.includes('contact') || lowerMessage.includes('help')) {
                response = "For additional help, you can contact the IT Department or submit an issue report through the system.";
            }

            res.json({ response });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = ChatbotController;

