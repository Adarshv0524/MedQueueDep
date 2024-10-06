import express from 'express';
import bcrypt from 'bcrypt'; // Ensure you have bcrypt installed
import db from '../db.js'; // Update the import based on your db file location
import { isAuthenticated } from '../middleware/auth.js'; // Update as necessary
import { logUserActivity} from '../utils/activityLogger.js';

const router = express.Router();

// -------------------------------------------------------------------------
// User Routes
// -------------------------------------------------------------------------

// Signup route (GET and POST)
router.get('/signup', (req, res) => {
  const error = req.session.error || null;
  req.session.error = null; 
  res.render('user/signup', { error }); 
});

router.post('/signup', async (req, res) => {
  const { username, password, firstName, lastName, email, phone, address } = req.body; 
  try {
    const [existingUser] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      req.session.error = 'User already exists';
      return res.redirect('/signup'); 
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

    await db.query('INSERT INTO user_profiles (user_id, first_name, last_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?)', 
      [result.insertId, firstName, lastName, email, phone, address]);

    await logUserActivity(result.insertId, 'User signed up');

    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Login route (GET and POST)
router.get('/login', (req, res) => {
  const error = req.session.error || null;
  req.session.error = null; 
  res.render('user/login', { error }); 
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [user] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (user.length === 0) {
      req.session.error = 'Invalid username or password';
      return res.redirect('/login'); 
    }

    const isMatch = await bcrypt.compare(password, user[0].password);
    if (isMatch) {
      req.session.userId = user[0].id;
      await logUserActivity(user[0].id, 'User logged in', req);
      res.redirect('/');
    } else {
      req.session.error = 'Invalid username or password';
      res.redirect('/login'); 
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Protected dashboard route
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const [user] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const [profile] = await db.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);

    if (!profile || profile.length === 0) {
      return res.status(404).send('Profile not found');
    }

    const [activityLogs] = await db.query('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC', [userId]);
    res.render('user/dashboard', { user: user[0], profile: profile[0], recentActivity: activityLogs });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Profile page (GET and POST)
router.get('/profile', isAuthenticated, async (req, res) => {
  const userId = req.session.userId; 
  try {
    const [user] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const [profile] = await db.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
    const [recentActivity] = await db.query('SELECT action, timestamp FROM activity_logs WHERE user_id = ? ORDER BY timestamp DESC', [userId]);

    res.render('user/profile', {
      user: user[0],
      profile: profile[0],
      recentActivity: recentActivity || [], // Initialize to an empty array if undefined
      successMessage: req.session.successMessage || null,
    });

    req.session.successMessage = null;
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST route for updating the profile based on selected field
router.post('/profile/update', isAuthenticated, async (req, res) => {
  console.log("Request Body:", req.body); // Log the request body
  const { updateField, newValue } = req.body; // Get the selected field and new value
  const userId = req.session.userId;

  // Map the form input to the database fields
  const fieldMapping = {
      firstName: 'first_name', // Mapping for first name
      lastName: 'last_name',   // Mapping for last name
      email: 'email',          // Mapping for email
      phone: 'phone',          // Mapping for phone
      address: 'address'       // Mapping for address
  };

  const dbField = fieldMapping[updateField];

  // Check if the selected field is valid
  if (!dbField) {
      return res.status(400).send('Invalid field selected');
  }

  try {
      // Update the user_profiles table based on the user_id
      const result = await db.query(`UPDATE user_profiles SET ${dbField} = ? WHERE user_id = ?`, [newValue, userId]);

      // Check if the update was successful
      if (result[0].affectedRows === 0) {
          return res.status(404).send('User profile not found');
      }

      // Log the user activity
      await logUserActivity(userId, `User updated ${updateField}`);

      // Redirect to the profile page with a success message
      req.session.successMessage = 'Profile updated successfully!';
      res.redirect('/profile');
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});



// Update password route (GET and POST)
router.get('/update-password', isAuthenticated, (req, res) => {
  const error = req.session.error || null; 
  req.session.error = null; 
  res.render('user/update-password', { error }); 
});

router.post('/update-password', isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const [user] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    const isMatch = await bcrypt.compare(currentPassword, user[0].password);
    if (!isMatch) {
      return res.send('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.session.userId]);
    await logUserActivity(req.session.userId, 'User updated password');
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Placeholder for future ML model integration
router.post('/api/predict', (req, res) => {
  const { someInput } = req.body;
  res.status(501).send('ML model integration is not yet implemented');
});

// Export the router
export default router;
