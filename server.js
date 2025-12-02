// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const { logAccess } = require('./middleware/accessLogger');
const ReminderController = require('./controllers/reminderController');

// Initialize database connection
require('./config/db');

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3001', 'http://localhost:3000'];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin) || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from frontend folder FIRST (before routes)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Serve uploaded files
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const issueRoutes = require('./routes/issueRoutes');
const eventRoutes = require('./routes/eventRoutes');
const transportationRoutes = require('./routes/transportationRoutes');
const dormRoutes = require('./routes/dormRoutes');
const parkingRoutes = require('./routes/parkingRoutes');
const tutoringRoutes = require('./routes/tutoringRoutes');
const employmentRoutes = require('./routes/employmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const lostFoundRoutes = require('./routes/lostFoundRoutes');
const nursingRoutes = require('./routes/nursingRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const classroomChangeRoutes = require('./routes/classroomChangeRoutes');
const preventiveMaintenanceRoutes = require('./routes/preventiveMaintenanceRoutes');
const systemConfigRoutes = require('./routes/systemConfigRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/transportation', transportationRoutes);
app.use('/api/dorms', dormRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/tutoring', tutoringRoutes);
app.use('/api/employment', employmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/nursing', nursingRoutes);
app.use('/api/admin/resources', resourceRoutes);
app.use('/api/faculty/classroom-change', classroomChangeRoutes);
app.use('/api/maintenance/preventive', preventiveMaintenanceRoutes);
app.use('/api/admin/config', systemConfigRoutes);

// Serve frontend pages (with .html extension)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.redirect('/login.html');
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.redirect('/signup.html');
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'signup.html'));
});

app.get('/dashboard/:role', (req, res) => {
    const role = req.params.role;
    const validRoles = ['student', 'faculty', 'maintenance', 'admin'];
    if (validRoles.includes(role)) {
        res.redirect(`/dashboard-${role}.html`);
    } else {
        res.status(404).send('Page not found');
    }
});

app.get('/dashboard-:role.html', (req, res) => {
    const role = req.params.role;
    const validRoles = ['student', 'faculty', 'maintenance', 'admin'];
    if (validRoles.includes(role)) {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'public', `dashboard-${role}.html`));
    } else {
        res.status(404).send('Page not found');
    }
});

// Start reminder checker (runs every 5 minutes)
setInterval(() => {
    ReminderController.checkAndSendReminders();
}, 5 * 60 * 1000);

// Error handling middleware (should be after all routes)
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Smart Campus System running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Backend folder: ${__dirname}`);
    console.log(`Frontend folder: ${path.join(__dirname, '..', 'frontend', 'public')}`);
    console.log(`Reminder service started (checks every 5 minutes)`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`   Please kill the process using this port or change the PORT environment variable.`);
        console.error(`   To find the process: netstat -ano | findstr :${PORT}`);
        console.error(`   To kill it: taskkill /PID <PID> /F`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
        process.exit(1);
    }
});
