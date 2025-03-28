const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../databaseConnection/database');
const auth = require('./auth');
const router = express.Router();

// Update list or make a new one
const createList = async function createList(req, res) {
  try {
    const { list_title, list_description, list_items: listItemsString} = JSON.parse(req.body.data);
    const list_items = JSON.parse(listItemsString);
    const userId = req.user.id;
    console.log('attempting createlist');
    if (userId) {
      const promisePool = pool.promise();
      const [result] = await promisePool.query(
        'CALL Update_list(?, ?, ?)',
        [userId, list_title, list_description]
      );
      console.log('console logging:' + result[0][0]);
      
      const [result2] = await promisePool.query(
        'CALL Delete_list_item(?, ?)',
        [result[0][0].listID, userId]
      );

      const promises = list_items.map((item) => {
        return promisePool.query(
          'CALL Update_list_item(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            result[0][0].listID,
            item.textString,
            item.scheduledCheckbox,
            item.scheduledDate,
            item.scheduledTime,
            item.taskTimeEstimate,
            item.recurringTask,
            item.recurringTaskEndDate,
            item.dueDateCheckbox,
            item.dueDate,
            item.complete
          ]
        );
      });

      await Promise.all(promises);
      res.status(201).json({ message: 'List created successfully' });
    } else {
      res.status(400).json({ message: 'User not authenticated' });
    }
  } catch (err) {
    console.error('Error creating list:', err);
    res.status(500).json({ message: 'Error creating list' });
  }
};

// 2. Read all lists (or one list by ID)
const getList = async function getList(req, res) {
  try {
    const promisePool = pool.promise();
    const userId = req.user.id; // Get the user ID from the JWT token
    const { list_title: listTitle } = req.body.params;

    if (userId) {
      const [lists] = await promisePool.query(
        'CALL Fetch_list(?, ?)', [userId, listTitle]
      );

      if (lists?.[0]?.[0]?.listID != null) {
        const [list_items] = await promisePool.query(
          'CALL Fetch_list_item(?)', lists[0][0].listID
        );

        // Merge the list and list_items
        const merged = { ...lists, ...list_items };
        //console.log(list_items);
        
        return res.json({ success: true, data: merged });
      } else {
        return res.json({ success: true, message: "No list exists for that title" });
      }
    } else {
      return res.status(400).json({ message: 'User not authenticated' });
    }
  } catch (error) {
    console.error("Error fetching lists:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

router.post('/', async (req, res) => {
  const { action } = req.body;
  if (action === 'getList') {
    return getList(req, res);
  } else if (action === 'createList') {
    return createList(req, res);
  }

  res.status(400).json({ error: 'Invalid action' });
});

module.exports = router;
