import express from 'express';
import path from 'path';
import session from 'express-session';
import dotenv from 'dotenv'; 
import flash from 'connect-flash';
import { fileURLToPath } from 'url';
import db from './db.js';
import bcrypt from 'bcrypt';

// import for routes 

import userRoutes from './routes/user.js'; // Correct path to user.js
import adminRoutes from './routes/admin.js';


// middleware import from middleware directory

import { jsonParser, urlencodedParser } from './middleware/bodyParser.js';
import { serveStaticFiles } from './middleware/staticFiles.js';
import { sessionMiddleware } from './middleware/session.js';
import { isAuthenticated } from './middleware/auth.js';
import { isAdminAuthenticated } from './middleware/auth.js';
import { notFoundHandler } from './middleware/errorHandlers.js';
import { globalErrorHandler } from './middleware/errorHandlers.js';

dotenv.config();

const app = express();

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views')); // Adjust the path as needed

// Middleware use

// Body parsers
app.use(urlencodedParser);
app.use(jsonParser);

// Serve Static files
app.use(serveStaticFiles);

// Sessios middleware
app.use(sessionMiddleware);


// Flash middleware
app.use(flash());

// ==========================================================
// ===================  ROUTES ==============================
// ==========================================================



// Home route
app.get('/', async (req, res) => {
    const userId = req.session.userId; // Get user ID from session
    let firstName = null; // Default value for firstName
  
    try {
        if (userId) {
            // Fetch user profile information to get the first name
            const [profile] = await db.query('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
  
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
  

app.use('/' , userRoutes);


app.use('/' , adminRoutes);


// Error handling middlewares
app.use(notFoundHandler);  // Handle 404 errors
app.use(globalErrorHandler);  // Handle 500 errors

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});