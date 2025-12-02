const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smartcampus',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // SSL configuration for production (Railway, etc.)
    ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true' 
        ? { rejectUnauthorized: false }
        : false
};

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
        connection.release();
    })
    .catch(err => {
        console.error('✗ MySQL Database connection error:', err.message);
        console.error('Please check your database configuration in environment variables:');
        console.error('  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
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

