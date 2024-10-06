import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import dotenv from 'dotenv';


dotenv.config(); // Load environment variables

const app = express();


// =============================================================== 
//                Path resolution for ES6 modules
// ===============================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ===============================================================
// Database connection Setup
// ===============================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


// ===================================================================
// Middleware setup
// ===================================================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');




// =================================================================
//Middleware functions
// =================================================================

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Middleware to check if admin is authenticated
function isAdminAuthenticated(req, res, next) {
  if (req.session.adminId) {
      next();
  } else {
      res.redirect('/admin'); // Redirect to admin login page if not authenticated
  }
}


// =================================================================
// Logging Functionality
// =================================================================

// Log user activity function
async function logUserActivity(userId, action, req = {}) {  // Set default for req as empty object
  try {
      // Ensure the user exists
      const [user] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
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
      await pool.query(query, [userId, action, ipAddress, timestamp]);

      console.info(`Activity logged: User ID ${userId}, Action: ${action}, IP: ${ipAddress}, Time: ${timestamp}`);
  } catch (error) {
      console.error('Error logging activity:', error);
  }
}



// ----------------------------------------------------------------
// =================================================================
// Routes
// =================================================================


// Home route
app.get('/', async (req, res) => {
  const userId = req.session.userId; // Get user ID from session
  let firstName = null; // Default value for firstName

  try {
      if (userId) {
          // Fetch user profile information to get the first name
          const [profile] = await pool.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

          // Check if profile exists
          if (profile && profile.length > 0) {
              firstName = profile[0].first_name; // Set firstName if profile exists
          }
      }

      // Render the index page with the user's first name (or null if not logged in)
      res.render('index', { firstName });
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});



// -------------------------------------------------------------------------
// User Routes
// -------------------------------------------------------------------------

// Signup route (GET and POST)

app.get('/signup', (req, res) => {
  const error = req.session.error || null; // Pass error variable to the view if it exists
  req.session.error = null; // Clear the error after displaying
  res.render('user/signup', { error }); // Pass error to the view
});

app.post('/signup', async (req, res) => {
  const { username, password, firstName, lastName, email, phone, address } = req.body; // Include additional fields
  try {
    // Check if user already exists
    const [existingUser] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      req.session.error = 'User already exists'; // Set error in session
      return res.redirect('/signup'); // Redirect to signup page
    }

    // Hash the password and insert the new user into the database
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

    // Insert user profile details
    await pool.query('INSERT INTO user_profiles (user_id, first_name, last_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)', 
    [result.insertId, firstName, lastName, email, phone, address]);

    // Log signup activity
    await logUserActivity(result.insertId, 'User signed up');

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


// ----------------------------------------------------------------
// Login route (GET and POST)
// ----------------------------------------------------------------

app.get('/login', (req, res) => {
  // Pass error variable to the view if it exists
  const error = req.session.error || null;
  req.session.error = null; // Clear the error after displaying
  res.render('user/login', { error }); // Pass error to the view
});

import axios from 'axios';

// Login route (POST)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
      // Find user in the database
      const [user] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      if (user.length === 0) {
          req.session.error = 'Invalid username or password'; // Set error in session
          return res.redirect('/login'); // Redirect to login page
      }

      // Compare passwords
      const isMatch = await bcrypt.compare(password, user[0].password);
      if (isMatch) {
          // Set session data
          req.session.userId = user[0].id;

          // Log login activity (make sure to pass req object)
          await logUserActivity(user[0].id, 'User logged in', req);

          res.redirect('/');
      } else {
          req.session.error = 'Invalid username or password'; // Set error in session
          res.redirect('/login'); // Redirect to login page
      }
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});



// ----------------------------------------------------------------
// Protected dashboard route
// ----------------------------------------------------------------

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
      const userId = req.session.userId;

      // Fetch user information
      const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      
      // Fetch user profile
      const [profile] = await pool.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

      // Check if profile exists
      if (!profile || profile.length === 0) {
          return res.status(404).send('Profile not found');
      }

      // Fetch user activity logs
      const [activityLogs] = await pool.query('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC', [userId]);

      // Pass activity logs as recentActivity
      res.render('user/dashboard', { user: user[0], profile: profile[0], recentActivity: activityLogs });
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});


// ----------------------------------------------------------------
// Profile page (GET and POST)
// ----------------------------------------------------------------

// Profile page (GET)
app.get('/profile', isAuthenticated, async (req, res) => {
  const userId = req.session.userId; // Get user ID from session
  try {
    // Fetch user information
    const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const [profile] = await pool.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

    // Fetch recent user activity logs
    const [recentActivity] = await pool.query('SELECT action, timestamp FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC', [userId]);

    // Check if recentActivity is defined, and if not, initialize it to an empty array
    if (!recentActivity) {
      recentActivity = []; // Initialize to an empty array if undefined
    }

    // Pass all necessary data to the profile view
    res.render('user/profile', {
      user: user[0],
      profile: profile[0],
      recentActivity, // Pass the recent activity data
      successMessage: req.session.successMessage || null, // Define successMessage
    });

    // Clear success message after displaying
    req.session.successMessage = null;
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


// ----------------------------------------------------------------
// POST route for updating the profile
// ----------------------------------------------------------------

app.post('/profile', isAuthenticated, async (req, res) => {
  const { username, firstName, lastName, email, phone, address } = req.body;
  const userId = req.session.userId;
  try {
    // Update user username and profile information
    await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
    await pool.query('UPDATE user_profiles SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ? WHERE user_id = ?', 
    [firstName, lastName, email, phone, address, userId]);

    // Log profile update activity
    await logUserActivity(userId, 'User updated profile');

    // Optionally, flash a success message
    req.flash('success', 'Profile updated successfully!');

    // Redirect back to the profile page
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});



// Update password route (GET and POST)
app.get('/update-password', isAuthenticated, (req, res) => {
  const error = req.session.error || null; // Define error
  req.session.error = null; // Clear the error after displaying
  res.render('user/update-password', { error }); // Pass error to the view
});


app.post('/update-password', isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    const isMatch = await bcrypt.compare(currentPassword, user[0].password);
    if (!isMatch) {
      return res.send('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.session.userId]);

    // Log password update activity
    await logUserActivity(req.session.userId, 'User updated password');

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Placeholder for future ML model integration
app.post('/api/predict', (req, res) => {
  const { someInput } = req.body;
  res.status(501).send('ML model integration is not yet implemented');
});





// =================================================================
// Admin functionalities
// =================================================================

// ----------------------------------------------------------------
// Admin login route (GET)
// ----------------------------------------------------------------

app.get('/admin', (req, res) => {
  const error = req.session.error || null; // Pass error variable to the view if it exists
  req.session.error = null; // Clear the error after displaying
  res.render('admin/login', { error }); // Render admin login view
});

// ----------------------------------------------------------------
// Admin login route (POST)
// ----------------------------------------------------------------

app.post('/admin', async (req, res) => {
  const { username, password } = req.body;

  try {
      // Find admin in the database
      const [admin] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
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
app.get('/admin/dashboard', isAdminAuthenticated, async (req, res) => {
  try {
    const adminId = req.session.adminId;
    
    // Fetch admin profile information
    const [adminProfile] = await pool.query('SELECT * FROM admins WHERE id = ?', [adminId]);

    // Fetch recent activity logs for the admin
    const [activities] = await pool.query('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC', [adminId]);

    const [users] = await pool.query('SELECT * FROM users');
    
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
app.get('/admin/manage-users', isAdminAuthenticated, async (req, res) => {
  try {
      const [users] = await pool.query('SELECT * FROM users'); // Fetch all users
      res.render('admin/manage-users', { users }); // Render manage users view with user data
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// Functionality to delete a user (example)
app.post('/admin/delete-user/:id', isAdminAuthenticated, async (req, res) => {
  const userId = req.params.id;
  try {
    // Check if user exists
    const [existingUser] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existingUser.length === 0) {
      req.session.error = 'User does not exist';
      return res.redirect('/admin/manage-users');
    }

    // Attempt to delete the user
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    await logUserActivity(req.session.adminId, `Deleted user with ID: ${userId}`);
    res.redirect('/admin/manage-users');
  } catch (err) {
    console.error(err);
    req.session.error = 'Error deleting user';
    res.redirect('/admin/manage-users');
  }
});


// GET route for updating user information
app.get('/admin/update-user/:id', isAdminAuthenticated, async (req, res) => {
  const userId = req.params.id;
  try {
      const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      const [profile] = await pool.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

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
app.post('/admin/update-user/:id', isAdminAuthenticated, async (req, res) => {
  const userId = req.params.id;
  const { username, firstName, lastName, email, phone, address } = req.body;
  try {
      await pool.query('UPDATE users SET username = ? WHERE id = ?', [username, userId]);
      await pool.query('UPDATE user_profiles SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ? WHERE user_id = ?',
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
app.post('/admin/reset-password/:id', isAdminAuthenticated, async (req, res) => {
  const userId = req.params.id;
  const { newPassword } = req.body;
  try {
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

      await logUserActivity(req.session.adminId, `Reset password for user with ID: ${userId}`);
      res.redirect('/admin/manage-users');
  } catch (err) {
      console.error(err);
      req.session.error = 'Error resetting password';
      res.redirect(`/admin/manage-users`);
  }
});


// Route to view activity logs
app.get('/admin/activity-logs', isAdminAuthenticated, async (req, res) => {
  try {
      const [activityLogs] = await pool.query('SELECT * FROM activity_logs ORDER BY timestamp DESC');
      res.render('admin/activity-logs', { activityLogs });
  } catch (err) {
      console.error(err);
      req.session.error = 'Error fetching activity logs';
      res.redirect('/admin/dashboard');
  }
});

// Route for sesarc
app.get('/admin/manage-users/serch' , isAdminAuthenticated , async (req , res) => {
  const {query} = req.query;
  try {
    const searchQuery  = `%${query}%` ; // user pattern mathch for sql
    const users = await pool.query(
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




app.get('/admin/manage-users/search', isAdminAuthenticated, async (req, res) => {
  const { query } = req.query;
  try {
      const searchQuery = `%${query}%`; // Pattern matching for SQL
      const users = await pool.query(
          'SELECT * FROM users WHERE username LIKE ? OR id LIKE ?',
          [searchQuery, searchQuery]
      );
      res.render('admin/manage-users', { users });
  } catch (err) {
      console.error(err);
      req.session.error = 'Error searching users';
      res.redirect('/admin/manage-users');
  }
});

// Catch-all route should come after specific routes like search
app.use((req, res) => {
  res.status(404).render('404'); // Render 404 page
});


app.get('/admin/view-user/:id', isAdminAuthenticated, async (req, res) => {
  const userId = req.params.id;
  try {
      const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
      if (user.length > 0) {
          res.render('admin/view-user', { user: user[0] });
      } else {
          req.session.error = 'User not found';
          res.redirect('/admin/manage-users');
      }
  } catch (err) {
      console.error(err);
      req.session.error = 'Error fetching user details';
      res.redirect('/admin/manage-users');
  }
});



// Admin logout route
app.get('/admin/logout', isAdminAuthenticated, async (req, res) => {
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


// Other admin routes and functionalities can be added similarly...



// Other routes go here...



// =================================================================
// Error Handling
// =================================================================

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Catch 404 and forward to error handler
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Middleware for handling 404 Not Found
app.use((req, res, next) => {
  res.status(404).render('error', { 
      message: 'Oops! Page not found', 
      errorCode: '404' 
  });
});

// Global error handler (optional for other errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
      message: 'Internal Server Error', 
      errorCode: '500' 
  });
});





// =================================================================
// Server listning
// =================================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
