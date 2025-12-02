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
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3001', 'http://localhost:3000'];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Allow requests from allowed origins, or if ALLOWED_ORIGINS is '*', allow all
    if (process.env.ALLOWED_ORIGINS === '*' || allowedOrigins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        // Same-origin request (no origin header)
        res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
        // Origin not allowed - but log it for debugging
        console.log(`[CORS] Blocked origin: ${origin}`);
        res.setHeader('Access-Control-Allow-Origin', '*'); // Allow for now, tighten later
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

// Request logging middleware (for debugging)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Serve static files from frontend folder (CSS, JS, images) - but NOT HTML files (handled by routes)
app.use('/css', express.static(path.join(__dirname, '..', 'frontend', 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, '..', 'frontend', 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, '..', 'frontend', 'public', 'images')));

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
const lostFoundRoutes = require('./routes/lostFoundRoutes');
const nursingRoutes = require('./routes/nursingRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const classroomChangeRoutes = require('./routes/classroomChangeRoutes');
const preventiveMaintenanceRoutes = require('./routes/preventiveMaintenanceRoutes');
const systemConfigRoutes = require('./routes/systemConfigRoutes');

// Health check endpoint (before other routes for easy testing)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'API is running', timestamp: new Date().toISOString() });
});

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
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/nursing', nursingRoutes);
app.use('/api/admin/resources', resourceRoutes);
app.use('/api/faculty/classroom-change', classroomChangeRoutes);
app.use('/api/maintenance/preventive', preventiveMaintenanceRoutes);
app.use('/api/admin/config', systemConfigRoutes);

// Serve frontend pages (with .html extension) - MUST be after API routes
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
        res.status(404).sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
    }
});

// Dashboard routes
app.get('/dashboard-student.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'dashboard-student.html'));
});

app.get('/dashboard-faculty.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'dashboard-faculty.html'));
});

app.get('/dashboard-maintenance.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'dashboard-maintenance.html'));
});

app.get('/dashboard-admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'dashboard-admin.html'));
});

// Start reminder checker (runs every 5 minutes)
setInterval(() => {
    ReminderController.checkAndSendReminders();
}, 5 * 60 * 1000);

// Error handling middleware (should be after all routes)
app.use((err, req, res, next) => {
    console.error('Error:', err);
    // Only return JSON for API routes
    if (req.path.startsWith('/api/')) {
        res.status(err.status || 500).json({
            error: process.env.NODE_ENV === 'production' 
                ? 'Internal server error' 
                : err.message
        });
    } else {
        // For non-API routes, redirect to home
        res.redirect('/');
    }
});

// 404 handler - catch-all for unmatched API routes (must be last)
app.use((req, res, next) => {
    // Only handle API routes with JSON response
    if (req.path.startsWith('/api/')) {
        console.log(`[404] API route not found: ${req.method} ${req.path}`);
        return res.status(404).json({ error: 'API route not found', path: req.path });
    }
    // For non-API routes, let it fall through (static files or HTML routes)
    next();
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Campus System running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Backend folder: ${__dirname}`);
    console.log(`Frontend folder: ${path.join(__dirname, '..', 'frontend', 'public')}`);
    console.log(`Reminder service started (checks every 5 minutes)`);
    console.log(`API Routes registered:`);
    console.log(`  - POST /api/auth/login`);
    console.log(`  - POST /api/auth/signup`);
    console.log(`  - GET /api/health`);
});

server.on('error', (err) => {
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
