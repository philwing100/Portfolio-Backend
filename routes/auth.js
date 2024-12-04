const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../databaseConnection/database'); // Database connection
const dbinfo = require('../databaseConnection/dbinfo.json'); // Contains Google OAuth credentials

const router = express.Router();

passport.use(new GoogleStrategy({
  clientID: dbinfo.googleClientId,
  clientSecret: dbinfo.googleClientSecret,
  callbackURL: '/api/auth/google/callback',
  passReqToCallback: true,
  // Force Google to show account selection
  prompt: 'select_account'
},
  async function googleStrategy(req, accessToken, refreshToken, profile, done) {
    try {
      const googleId = profile.id;
      const email = profile.emails[0].value;

      // Check if the user already exists
      const [results] = await pool.promise().query('SELECT * FROM users WHERE google_id = ?', [googleId]);
      console.log('Found this many users: ' + results.length);
      if (results.length > 0) {
        return done(null, results[0]);
      } else {
        await pool.promise().query('INSERT INTO users (google_id, email) VALUES (?, ?)', [googleId, email]);
        const [newUserResults] = await pool.promise().query('SELECT * FROM users WHERE google_id = ?', [googleId]);
        return done(null, newUserResults[0]);
      }
    } catch (err) {
      console.warn('Error during Google authentication:', err,...arguments);
      return done(err);
    }
  }));


// Serialize and deserialize user
passport.serializeUser(function serializeUser(user, done) {
  done(null, user.userID);
});

passport.deserializeUser(async function deserializeUser(userID, done) {
  try {
    const [results] = await pool.promise().query('SELECT * FROM users WHERE userID = ?', [userID]);
    done(null, results[0]);
  } catch (err) {
    console.warn(err,...arguments);
    done(err);
  }
});

router.get('/google', passport.authenticate('google', { 
  scope: ['email'], 
  prompt: 'select_account'
}));

// Google callback route
router.get('/google/callback',
  passport.authenticate('google', {
    successRedirect: '/api/auth/success',
    failureRedirect: '/api/auth/failure'
  })
);

// Success route
router.get('/success', function success(req, res) {
  if (req.isAuthenticated()) {
    // Redirecting back to the dashboard while sending the session cookie
    res.cookie('sessionId', req.sessionID, { httpOnly: process.env.NODE_ENV === 'production', secure: process.env.NODE_ENV === 'production' });
    return res.redirect('http://localhost:8080/'); // Redirecting to the Vue app's dashboard
  } else {
    res.status(401).json({ message: 'User not authenticated' });
  }
});

router.get('/failure', function failure(req, res) {
  res.status(401).json({ message: 'Login failed' });
});

// Logout route
router.post('/logout', function logout(req, res) {
  req.logout(function logout(err){
    if (err) {
      console.warn('Error logging out:', err,...arguments);
      return res.status(500).json({ message: 'Logout failed' });
    }
    req.session.destroy(function destroy(){ // Destroy session after logout
      res.clearCookie('sessionId'); // Clear any session cookie if needed
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
});

// Route to check if user is authenticated
router.get('/check-auth',function checkAuth(req, res) {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

module.exports = router;
