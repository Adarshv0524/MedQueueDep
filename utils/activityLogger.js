import db from '../db.js';

// Log user activity function
export async function logUserActivity(userId, action, req = {}) {  // Set default for req as empty object
    try {
        // Ensure the user exists
        const [user] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (user.length === 0) {
            console.error(`User with ID ${userId} does not exist. Activity log not recorded.`);
            return; // Exit if user doesn't exist
        }
  
        // Get current timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  
        // Get user's IP address (fallback to 'unknown' if req or headers are undefined)
        const ipAddress = req?.headers?.['x-forwarded-for'] || req?.ip || 'unknown';
  
        const query = `
            INSERT INTO activity_logs (user_id, action, ip_address, timestamp) 
            VALUES (?, ?, ?, ?)
        `;
        await db.query(query, [userId, action, ipAddress, timestamp]);
  
        console.info(`Activity logged: User ID ${userId}, Action: ${action}, IP: ${ipAddress}, Time: ${timestamp}`);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
  }
  