const express = require('express');
const router = express.Router();
const pool = require('../databaseConnection/database');

// Middleware to check if the user is authenticated
const isAuthenticated = function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    console.log('they is authed for lists');
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

// CRUD Functions for Lists
// 1. Create a new list
const createList = async function createList(req, res) {
  console.log('top of create list)');
  const { list_title, list_description } = req.body;
  const { userID } = req.user; // Assuming userID is available in req.user if authenticated
  
  try {
    const promisePool = pool.promise();
    // Call the stored procedure to create the list
    const [result] = await promisePool.query(
      'CALL Create_new_list(?, ?, ?)', 
      [userID, list_title || null, list_description || null]
    );
    res.status(201).json({ message: 'List created successfully', listID: result[0].listID });
  } catch (err) {
    console.warn('Error creating list:', err,...arguments);
    res.status(500).json({ message: 'Error creating list' });
  }
};

// 2. Read all lists (or one list by ID)
const getLists = async function getLists(req, res) {
  try {
    const promisePool = pool.promise();
    // Query to fetch lists from the database
    const [lists] = await promisePool.query('SELECT * FROM lists');
    res.json({ lists });
  } catch (err) {
    console.warn('Error fetching lists:', err,...arguments);
    res.status(500).json({ message: 'Error fetching lists' });
  }
};

// 3. Update a list by ID
const updateList = async function updateList(req, res) {
  const { id } = req.params;
  const { list_title, list_description } = req.body;
  
  try {
    const promisePool = pool.promise();
    // Call the stored procedure to update the list
    const [result] = await promisePool.query(
      'CALL Update_list(?, ?, ?, ?)', 
      [id, list_title || null, list_description || null, req.user.userID]
    );
    res.json({ message: 'List updated successfully' });
  } catch (err) {
    console.warn('Error updating list:', err,...arguments);
    res.status(500).json({ message: 'Error updating list' });
  }
};

const deleteList = async function deleteList(req, res) {
  const { id } = req.params;
  const { userID } = req.user; // Assuming the userID is available in req.user if authenticated

  try {
    const promisePool = pool.promise();

    // First, delete all list items associated with the given listID using the stored procedure
    await promisePool.query(
      'CALL Delete_all_list_items(?)', 
      [id]
    );

    // Then, delete the list itself
    await promisePool.query(
      'CALL Delete_list(?, ?)', 
      [id, userID]
    );

    res.json({ message: 'List and all associated items deleted successfully' });
  } catch (err) {
    console.error('Error deleting list and items:', err,...arguments);
    res.status(500).json({ message: 'Error deleting list and items' });
  }
};


// CRUD API Endpoints for Lists
router.post('/', createList);      // Create a list
router.get('/', getLists);         // Read lists
router.put('/:id', updateList);    // Update a list
router.delete('/:id', deleteList); // Delete a list

module.exports = router;
