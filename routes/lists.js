const express = require('express');
const router = express.Router();
const pool = require('../databaseConnection/database');

// Middleware to check if the user is authenticated
const isAuthenticated = function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

// Update list or make a new one
const createList = async function createList(req, res) {
  try {
    const { Authorization: sessionId } = req.body.headers;
    const parsedData = JSON.parse(req.body.data);
    const { list_title, list_description } = parsedData;
    const list_items = JSON.parse(parsedData.list_items);

    if (sessionId) {
      const user = await getUserID(sessionId);
      console.log(user);
      if (Number.isInteger(user)) {

        console.log(req.body);
        console.log(list_items[5]);

        const promisePool = pool.promise();
        // Call the stored procedure to create the list
        const [result] = await promisePool.query(
          'CALL Update_list(?, ?, ?)',
          [user, list_title, list_description]
        );
        //console.log(result[0][0].listID);

        const [deleted] = await promisePool.query(
          'CALL Delete_list_item(?, ?)',
          [result[0][0].listID, user]
        );

        /*if(deleted.affectedRows == 0){
          res.status(401).json({ message: 'Unauthorized access' });
        }*/

        const promises = list_items.map((item) => {
          return promisePool.query('CALL Update_list_item(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [result[0][0].listID, item.textString, item.scheduledCheckbox, item.scheduledDate, item.scheduledTime, item.taskTimeEstimate,
            item.recurringTask, item.recurringTaskEndDate, item.dueDateCheckbox, item.dueDate, item.complete
            ]);
        });

        const [results] = await Promise.all(promises);

        res.status(201).json({ message: 'List created successfully' });
      }
    }
  } catch (err) {
    console.warn('Error creating list:', err);
    res.status(500).json({ message: 'Error updating list' });
  }
};

// 2. Read all lists (or one list by ID)
const getList = async function getList(req, res) {
  try {
    const promisePool = pool.promise();
    const { Authorization: sessionId } = req.body.headers;
    const { list_title: listTitle } = req.body.params;
    if (sessionId) {
      const user = await getUserID(sessionId);
      if (Number.isInteger(user)) {
        const [lists] = await promisePool.query(
          'CALL Fetch_list(?, ?)', [user, listTitle]);

        if (lists?.[0]?.[0]?.listID != null) {
          const [list_items] = await promisePool.query(
            'CALL Fetch_list_item(?)', lists[0][0].listID);

          //console.log("bruh2 " + [list_items][0][0]);

          const merged = { ...lists, ...list_items };

          return res.json({ success: true, data: merged });
        } else {
          return res.json({ success: true, message: "No list exists for that title" });
        }
      }
    }
  } catch (error) {
    console.error("Error fetching lists:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

async function getUserID(sessionID) {
  try {
    const promisePool = pool.promise();
    const [rows] = await promisePool.query(
      'SELECT data FROM sessions WHERE sessionID = (?) LIMIT 1',
      [sessionID]
    );

    if (rows.length !== 0) {
      const jsonData = JSON.parse(rows[0].data);
      return jsonData.passport.user;
    } else {
      console.error('No json data found for session');
    }
  } catch (err) {
    console.error('Error retrieving the userID', err, ...arguments);
    return 'Err invalid session ID';
  }
}

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
