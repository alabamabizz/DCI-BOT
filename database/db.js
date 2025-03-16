const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise(); // Use promise-based queries

// Test database connection
async function testConnection() {
    try {
        const [rows] = await db.query('SELECT 1'); // Run a simple test query
        console.log('✅ Connected to the database!');
    } catch (error) {
        console.error('❌ Database Connection Error:', error);
        process.exit(1);
    }
}

testConnection();

module.exports = db;
