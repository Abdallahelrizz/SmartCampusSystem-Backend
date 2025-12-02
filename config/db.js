const mysql = require('mysql2/promise');

// Database configuration
// Support Railway's MYSQL_URL format or individual variables
let dbConfig;

if (process.env.MYSQL_URL) {
    // Railway provides MYSQL_URL in format: mysql://user:password@host:port/database
    const url = new URL(process.env.MYSQL_URL);
    dbConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading '/'
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
} else {
    // Use individual environment variables
    dbConfig = {
    host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smartcampus',
    waitForConnections: true,
    connectionLimit: 10,
        queueLimit: 0,
        // SSL configuration for production (Railway, etc.)
        ssl: process.env.NODE_ENV === 'production' && (process.env.DB_SSL === 'true' || process.env.MYSQL_URL)
            ? { rejectUnauthorized: false }
            : false
};
}

// Ensure required environment variables are set
if (!process.env.DB_PASSWORD && process.env.NODE_ENV === 'production') {
    console.error('✗ DB_PASSWORD environment variable is required in production');
    process.exit(1);
}

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('✓ MySQL Database connected successfully');
        console.log(`  Host: ${dbConfig.host}:${dbConfig.port || 3306}`);
        console.log(`  Database: ${dbConfig.database}`);
        connection.release();
    })
    .catch(err => {
        console.error('✗ MySQL Database connection error:', err.message);
        console.error('Please check your database configuration in environment variables:');
        if (process.env.MYSQL_URL) {
            console.error('  MYSQL_URL (Railway format)');
        } else {
            console.error('  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT');
        }
        console.error(`  Current config - Host: ${dbConfig.host}, Port: ${dbConfig.port || 3306}, Database: ${dbConfig.database}, User: ${dbConfig.user}`);
    });

// Helper function to execute queries
const query = async (sql, params = []) => {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Helper function for transactions
const transaction = async (callback) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    pool,
    query,
    transaction
};

