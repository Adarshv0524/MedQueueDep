import express from 'express';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise'; // Ensure you have mysql2 installed
import { isAuthenticated } from './middlewares/authMiddleware.js'; // Middleware to check if the user is authenticated
import { logAdminActivity } from './utils/logging.js'; // Log admin activity

const router = express.Router();

// MySQL connection pool setup
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Admin Dashboard - Fetches user count and recent activity logs
router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Fetch user count
        const [userCount] = await pool.query('SELECT COUNT(*) AS count FROM users');
        
        // Fetch recent activity logs
        const [activityLogs] = await pool.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 10');

        res.render('admin/dashboard', {
            userCount: userCount[0].count,
            recentActivity: activityLogs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// View all users
router.get('/users', isAuthenticated, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT * FROM users');
        res.render('admin/users', { users });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Edit user information (GET and POST)
router.get('/users/:id/edit', isAuthenticated, async (req, res) => {
    const userId = req.params.id;
    try {
        const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        res.render('admin/edit-user', { user: user[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

router.post('/users/:id/edit', isAuthenticated, async (req, res) => {
    const userId = req.params.id;
    const { username, email, phone } = req.body;

    try {
        await pool.query('UPDATE users SET username = ?, email = ?, phone = ? WHERE id = ?', [username, email, phone, userId]);
        await logAdminActivity(req.session.adminId, `Edited user information for user ID ${userId}`);
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Delete a user
router.post('/users/:id/delete', isAuthenticated, async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        await logAdminActivity(req.session.adminId, `Deleted user ID ${userId}`);
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Reset user password
router.post('/users/:id/reset-password', isAuthenticated, async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        await logAdminActivity(req.session.adminId, `Reset password for user ID ${userId}`);
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// View all activity logs
router.get('/activity-logs', isAuthenticated, async (req, res) => {
    try {
        const [logs] = await pool.query('SELECT * FROM activity_logs ORDER BY timestamp DESC');
        res.render('admin/activity-logs', { logs });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Delete an activity log
router.post('/activity-logs/:id/delete', isAuthenticated, async (req, res) => {
    const logId = req.params.id;
    try {
        await pool.query('DELETE FROM activity_logs WHERE id = ?', [logId]);
        await logAdminActivity(req.session.adminId, `Deleted activity log ID ${logId}`);
        res.redirect('/admin/activity-logs');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Block/Unblock user
router.post('/users/:id/block-unblock', isAuthenticated, async (req, res) => {
    const userId = req.params.id;
    const { action } = req.body; // Action: 'block' or 'unblock'

    try {
        const status = action === 'block' ? 'blocked' : 'active';
        await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
        await logAdminActivity(req.session.adminId, `${action === 'block' ? 'Blocked' : 'Unblocked'} user ID ${userId}`);
        res.redirect('/admin/users');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// View system settings
router.get('/system-settings', isAuthenticated, async (req, res) => {
    try {
        const settings = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        };
        res.render('admin/system-settings', { settings });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Update system settings
router.post('/system-settings', isAuthenticated, async (req, res) => {
    const { dbHost, dbUser, dbPassword, dbName } = req.body;

    try {
        // Update environment variables (you'll need to handle saving the updated env vars securely)
        process.env.DB_HOST = dbHost;
        process.env.DB_USER = dbUser;
        process.env.DB_PASSWORD = dbPassword;
        process.env.DB_NAME = dbName;

        await logAdminActivity(req.session.adminId, 'Updated system settings');
        res.redirect('/admin/system-settings');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

export default router;
