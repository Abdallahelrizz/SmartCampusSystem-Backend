const mysql = require('mysql2/promise');

// Database configuration
// Railway provides MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
// Also supports DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
const dbConfig = {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? null : 'localhost'),
    user: process.env.MYSQL_USER || process.env.DB_USER || (process.env.NODE_ENV === 'production' ? null : 'root'),
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || (process.env.NODE_ENV === 'production' ? null : ''),
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || (process.env.NODE_ENV === 'production' ? null : 'smartcampus'),
    port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // SSL configuration for production (Railway requires SSL)
    ssl: (process.env.NODE_ENV === 'production' || process.env.MYSQL_HOST || process.env.DB_HOST) 
        ? { rejectUnauthorized: false }
        : false
};

// Ensure required environment variables are set in production
if (process.env.NODE_ENV === 'production') {
    const hasHost = process.env.MYSQL_HOST || process.env.DB_HOST;
    const hasPassword = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
    const hasUser = process.env.MYSQL_USER || process.env.DB_USER;
    const hasDatabase = process.env.MYSQL_DATABASE || process.env.DB_NAME;
    
    if (!hasHost || !hasPassword || !hasUser || !hasDatabase) {
        console.error('✗ Database environment variables are required in production');
        console.error('   Required: DB_HOST (or MYSQL_HOST), DB_USER (or MYSQL_USER), DB_PASSWORD (or MYSQL_PASSWORD), DB_NAME (or MYSQL_DATABASE)');
        process.exit(1);
    }
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

