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

// Path resolution for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Log user activity function
async function logUserActivity(userId, action) {
  try {
    await pool.query('INSERT INTO activity_logs (user_id, action) VALUES (?, ?)', [userId, action]);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Routes
app.get('/', (req, res) => {
  res.render('index'); // Render login page
});

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

// Login route (GET and POST)
app.get('/login', (req, res) => {
  // Pass error variable to the view if it exists
  const error = req.session.error || null;
  req.session.error = null; // Clear the error after displaying
  res.render('user/login', { error }); // Pass error to the view
});

import axios from 'axios';

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

          // Log login activity
          await logUserActivity(user[0].id, 'User logged in');

          res.redirect('/dashboard');
      } else {
          req.session.error = 'Invalid username or password'; // Set error in session
          res.redirect('/login'); // Redirect to login page
      }
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});





// Protected dashboard route
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



// Profile page (GET and POST)

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


// POST route for updating the profile
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

// 404 Error handling
app.use((req, res) => {
  res.status(404).render('error');
});

// Vercel deployment configuration
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
