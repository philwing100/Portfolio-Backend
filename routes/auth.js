const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../databaseConnection/database'); // Database connection
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

const port = process.env.FRONTENDPORT || 3000;
const frontendPath = port == 3000 ? "http://localhost:8080" : "https://phillip-ring.vercel.app";

// Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.googleClientId,
  clientSecret: process.env.googleClientSecret,
  callbackURL: '/api/auth/google/callback',
  passReqToCallback: true,
  prompt: 'select_account'
},
  async function googleStrategy(req, accessToken, refreshToken, profile, done) {
    try {
      const googleId = profile.id;
      const email = profile.emails[0].value;

      // Check if the user already exists
      const [results] = await pool.promise().query('SELECT * FROM users WHERE google_id = ?', [googleId]);
      if (results.length > 0) {
        // If user exists, return user
        console.log('retrieving from db' + results[0]);
        return done(null, results[0]);
      } else {
        // If user does not exist, create new user
        await pool.promise().query('INSERT INTO users (google_id, email) VALUES (?, ?)', [googleId, email]);
        const [newUserResults] = await pool.promise().query('SELECT * FROM users WHERE google_id = ?', [googleId]);
        return done(null, newUserResults[0]);
      }
    } catch (err) {
      console.warn('Error during Google authentication:', err);
      return done(err);
    }
  }));

// Google login route
router.get('/google', passport.authenticate('google', {
  scope: ['email'],
  prompt: 'select_account',
  session: false 
}));

// Google callback route
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/failure',
    session: false 
  }),
  (req, res) => {
    // If authentication is successful, generate a JWT token and redirect to frontend
    const token = jwt.sign(
      { id: req.user.userID, email: req.user.email },  // Create a payload with user data
      process.env.JWT_SECRET,  // Secret key for JWT signing
      { expiresIn: '2h' }  // Set token expiry time
    );

    console.log('assigniing token on login: '+ token);
    const redirectUrl = `${frontendPath}/login?token=${token}`;
    res.redirect(redirectUrl);  // Redirect to the frontend with the token in the URL
  }
);

// Failure route for Google login
router.get('/failure', (req, res) => {
  res.status(401).json({ message: 'Login failed' });
});

// Logout route
router.post('/logout', (req, res) => {
  console.log('logged out');
  res.status(200).json({ message: 'Logged out successfully' });
});

// Route to check if the user is authenticated using JWT (for protected routes)
router.get('/check-auth', (req, res) => {
  const token = req.headers['authorization'];
  console.log("toke: "+ token);
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Verify err: " + err);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // If the token is valid, return user info
    console.log('Checking auth: ' + user.email);
    res.json({ user });
  });
});

/*export function isAuthenticated(req){
  const token = req.headers['authorization'];
  console.log("toke: "+ token);
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
}$*/

module.exports = router;
