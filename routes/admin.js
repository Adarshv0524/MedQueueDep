import express from 'express';
import bcrypt from 'bcrypt'; // Ensure you have bcrypt installed
import db from '../db.js'; // Update the import based on your db file location
import { isAdminAuthenticated } from '../middleware/auth.js'; // Update as necessary
import { logUserActivity} from '../utils/activityLogger.js';

const router = express.Router();









// =================================================================
// Admin functionalities
// =================================================================

// ----------------------------------------------------------------
// Admin login route (GET)
// ----------------------------------------------------------------

router.get('/admin', (req, res) => {
    const error = req.session.error || null; // Pass error variable to the view if it exists
    req.session.error = null; // Clear the error after displaying
    res.render('admin/login', { error }); // Render admin login view
  });
  
  // ----------------------------------------------------------------
  // Admin login route (POST)
  // ----------------------------------------------------------------
  
  router.post('/admin', async (req, res) => {
    const { username, password } = req.body;
  
    try {
        // Find admin in the database
        const [admin] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
        if (admin.length === 0) {
            req.session.error = 'Invalid username or password'; // Set error in session
            return res.redirect('/admin'); // Redirect to admin login page
        }
  
        // Compare passwords
        const isMatch = await bcrypt.compare(password, admin[0].password);
        if (password === admin[0].password) {
            // Set session data for admin
            req.session.adminId = admin[0].id;
  
            // Log admin login activity
            await logUserActivity(admin[0].id, 'Admin logged in');
  
            res.redirect('/admin/dashboard'); // Redirect to admin dashboard
        } else {
            req.session.error = 'Invalid username or password'; // Set error in session
            res.redirect('/admin'); // Redirect to admin login page
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
  });
  
  
  // -------------------------------------------------------------------------
  // Admin dashboard route (GET)
  // -------------------------------------------------------------------------
  
  // Admin dashboard route (GET)
  router.get('/admin/dashboard', isAdminAuthenticated, async (req, res) => {
    try {
      const adminId = req.session.adminId;
      
      // Fetch admin profile information
      const [adminProfile] = await db.query('SELECT * FROM admins WHERE id = ?', [adminId]);
  
      // Fetch recent activity logs for the admin
      const [activities] = await db.query('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC', [adminId]);
  
      const [users] = await db.query('SELECT * FROM users');
      
      res.render('admin/admin', {
        admin: adminProfile[0], // Pass admin profile data to the template
        activities, // Pass admin activities to the template
        users
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });
  
  
  
  // Additional admin functionalities routes
  // For example, manage users
  router.get('/admin/manage-users', isAdminAuthenticated, async (req, res) => {
    try {
        const [users] = await db.query('SELECT * FROM users'); // Fetch all users
        res.render('admin/manage-users', { users }); // Render manage users view with user data
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
  });
  
  // Functionality to delete a user (example)
  router.post('/admin/delete-user/:id', isAdminAuthenticated, async (req, res) => {
    const userId = req.params.id;
    try {
      // Check if user exists
      const [existingUser] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
      if (existingUser.length === 0) {
        req.session.error = 'User does not exist';
        return res.redirect('/admin/manage-users');
      }
  
      // Attempt to delete the user
      await db.query('DELETE FROM users WHERE id = ?', [userId]);
      await logUserActivity(req.session.adminId, `Deleted user with ID: ${userId}`);
      res.redirect('/admin/manage-users');
    } catch (err) {
      console.error(err);
      req.session.error = 'Error deleting user';
      res.redirect('/admin/manage-users');
    }
  });
  
  
  // GET route for updating user information
  router.get('/admin/update-user/:id', isAdminAuthenticated, async (req, res) => {
    const userId = req.params.id;
    try {
        const [user] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const [profile] = await db.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  
        if (user.length === 0 || profile.length === 0) {
            req.session.error = 'User not found';
            return res.redirect('/admin/manage-users');
        }
  
        res.render('admin/update-user', { user: user[0], profile: profile[0] });
    } catch (err) {
        console.error(err);
        req.session.error = 'Error fetching user information';
        res.redirect('/admin/manage-users');
    }
  });
  
  // POST route for updating user information
  router.post('/admin/update-user/:id', isAdminAuthenticated, async (req, res) => {
    const userId = req.params.id;
    const { username, firstName, lastName, email, phone, address } = req.body;
    try {
        await db.query('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
        await db.query('UPDATE user_profiles SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ? WHERE user_id = ?',
            [firstName, lastName, email, phone, address, userId]);
  
        await logUserActivity(req.session.adminId, `Updated user with ID: ${userId}`);
        res.redirect('/admin/manage-users');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error updating user information';
        res.redirect(`/admin/update-user/${userId}`);
    }
  });
  
  
  // POST route for resetting user password
  router.post('/admin/reset-password/:id', isAdminAuthenticated, async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;
    try {
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);
  
        await logUserActivity(req.session.adminId, `Reset password for user with ID: ${userId}`);
        res.redirect('/admin/manage-users');
    } catch (err) {
        console.error(err);
        req.session.error = 'Error resetting password';
        res.redirect(`/admin/manage-users`);
    }
  });
  
  
  // Route to view activity logs
  router.get('/admin/activity-logs', isAdminAuthenticated, async (req, res) => {
    try {
        const [activityLogs] = await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC');
        res.render('admin/activity-logs', { activityLogs });
    } catch (err) {
        console.error(err);
        req.session.error = 'Error fetching activity logs';
        res.redirect('/admin/dashboard');
    }
  });
  
  // Route for sesarc
  router.get('/admin/manage-users/serch' , isAdminAuthenticated , async (req , res) => {
    const {query} = req.query;
    try {
      const searchQuery  = `%${query}%` ; // user pattern mathch for sql
      const users = await db.query(
        'SELECT * FROM users WHERE username LIKE ? OR id LIKE ?',
        [searchQuery, searchQuery]
      );
      res.render('admin/manage-users' , {users});
    } catch (err) {
      console.error(err);
      req.sesssion.error = 'Error searching users';
      res.redirect('/admin/manage-users');
    }
  })
  
  
  
  
  // Admin logout route
  router.get('/admin/logout', isAdminAuthenticated, async (req, res) => {
    const adminId = req.session.adminId;
  
    if (adminId) {
      // Log admin logout activity
      await logUserActivity(adminId, 'Admin logged out', req);
    }
  
    // Destroy the admin session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).send('Error logging out');
      }
  
      // Redirect to admin login page after successful logout
      res.redirect('/admin');
    });
  });


// Export the router
export default router;
