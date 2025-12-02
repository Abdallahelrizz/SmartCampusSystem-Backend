const { query } = require('../config/db');

function logAccess(req, res, next) {
    // Only log if user is authenticated (will be set by auth middleware)
    if (!req.user) {
        return next();
    }
    
    const logEntry = {
        user_id: req.user?.user_id || null,
        email: req.user?.email || null,
        role: req.user?.role || 'anonymous',
        endpoint: req.path,
        method: req.method,
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date(),
        success: true
    };

    // Log the access asynchronously (don't block the request)
    // Schema fields: log_id, user_id, action, resource, ip_address, timestamp
    query(
        `INSERT INTO accesslogs (user_id, action, resource, ip_address, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [logEntry.user_id, `${logEntry.method} ${logEntry.endpoint}`, logEntry.endpoint, 
         logEntry.ip, logEntry.timestamp]
    ).catch(err => {
        console.error('Failed to log access:', err);
    });

    // Clean up old logs periodically (keep only last 10000)
    // This can be done via a scheduled job, but for now we'll just insert
    // In production, you'd want a cleanup job

    // Log failed login attempts
    if (req.path.includes('/login') && req.method === 'POST') {
        const originalJson = res.json;
        res.json = function(data) {
            if (data.error || res.statusCode >= 400) {
                logEntry.success = false;
                logEntry.error = data.error || 'Login failed';
                
                // Log failed attempt
                // Schema fields: log_id, user_id, action, resource, ip_address, timestamp
                query(
                    `INSERT INTO accesslogs (user_id, action, resource, ip_address, timestamp)
                     VALUES (?, ?, ?, ?, ?)`,
                    [logEntry.user_id, `FAILED ${logEntry.method} ${logEntry.endpoint}`, logEntry.endpoint, 
                     logEntry.ip, new Date()]
                ).catch(err => {
                    console.error('Failed to log failed login:', err);
                });
            }
            return originalJson.call(this, data);
        };
    }

    next();
}

module.exports = { logAccess };
