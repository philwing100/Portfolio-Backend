const express = require('express'); 
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const MySQLStore = require('express-mysql-session')(session);
const bodyParser = require('body-parser');
const cors = require('cors');
const pool = require('./databaseConnection/database'); // Database pool connection
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.FRONTENDPORT || 3000;
const frontendPath =  port === 3000 ? "http://localhost:8080" : "https://phillip-ring.vercel.app/";

// Session store options
const options = {
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'sessionID',
      expires: 'expires',
      data: 'data'
    }
  }
};
//
// Create a session store using MySQL
const sessionStore = new MySQLStore(options, pool.promise());

// Middleware to parse cookies and JSON bodies
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS with credentials to allow cookie usage across origins
app.use(cors({
  origin: frontendPath, // Your frontend origin
  credentials: true, // Allow cookies and credentials to be shared
}));

// Session middleware configuration
app.use(session({
  key: process.env.key, // Unique session key
  secret: process.env.secret, // Secret used to sign the session cookie
  store: sessionStore, // Store session in MySQL
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 120, // Set cookie lifespan (30 minutes)
    httpOnly: true,
    secure: false, // Set true if using HTTPS (adjust for production)
    sameSite: 'lax',
  },
}));

// Initialize Passport for authentication
app.use(passport.initialize());
app.use(passport.session());

// Authentication middleware
const isAuthenticated = (req, res, next) => req.isAuthenticated() ? next() : res.status(401).json({
  message: 'Unauthorized access, please login.'
});

// Define authentication routes that should not require `isAuthenticated`
const authRoutes = ['/logout', '/auth'];

// Apply `isAuthenticated` to all `/api` routes except specified authentication routes
app.use('/api', (req, res, next) => {
  console.log(req.path);
  if (authRoutes.some(route => req.path.startsWith(route))) {
    console.log('skipping');
    // If the path starts with an authentication route, skip `isAuthenticated`
    return next();
  } else {
    // Apply `isAuthenticated` to all other `/api` routes
    console.log('authenticating');
    return isAuthenticated(req, res, next);
  }
});

// Import and use routes
const routes = require('./routes/index');
app.use('/api', routes); // Apply isAuthenticated globally to `/api` routes

// Start server
if(port === 3000){
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
} else{
  module.exports = app;
}
