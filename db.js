import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Optional: A test function to check if the connection is established successfully
async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log("Database connected successfully!");
        connection.release();  // Release the connection back to the pool
    } catch (err) {
        console.error("Error connecting to the database:", err.message);
    }
}

// Run the test connection (optional)
testConnection();

// Export the pool for use in other modules
export default db;
