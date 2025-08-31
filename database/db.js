// This file will no longer call dotenv.config(). Your main server.js will.
const pool = require('./pool'); // Correctly imports the pool

module.exports = {
  // This is a generic query function. It's good for testing, but for your app,
  // you'll mostly use specific functions like the one below.
  query: (text, params) => pool.query(text, params),

  /** 
   * Finds a user by their phone number, creating a new user if one doesn't exist.
   * @param {string} phoneNumber The user's phone number.
   * @returns {Promise<number>} The user's ID.
   */
  findOrCreateUserByPhone: async (phoneNumber) => {
        console.log("pass",process.env.PGPASSWORD)

    const client = await pool.connect();
    try {
      // First, try to find the user
      const findUserQuery = 'SELECT id FROM users WHERE phone_number = $1';
      const userResult = await client.query(findUserQuery, [phoneNumber]);

      if (userResult.rows.length > 0) {
        console.log(`Found existing user with id: ${userResult.rows[0].id}`);
        return userResult.rows[0].id; // User exists, return their ID
      }

      // If user not found, create them
      console.log(`User not found, creating new user for ${phoneNumber}`);
      const createUserQuery = 'INSERT INTO users (phone_number, username) VALUES ($1, $1) RETURNING id';
      const newUserResult = await client.query(createUserQuery, [phoneNumber]);
      console.log(`Created new user with id: ${newUserResult.rows[0].id}`);
      return newUserResult.rows[0].id; // Return the new user's ID
    } catch (e) {
      console.error('Error in findOrCreateUserByPhone', e);
      throw e;
    } finally {
      client.release();
    }
  },

  createTransaction: async (userId, transactionData) => {
    const { type, items } = transactionData.transaction;

    // Calculate the total amount from all items
    const totalAmount = items.reduce((sum, item) => {
      return sum + (item.quantity * item.price_per_item);
    }, 0);

    // Get a client from the pool
    const client = await pool.connect();

    try {
      // Start the transaction
      await client.query('BEGIN');

      // 1. Insert into the 'transactions' table
      const transactionInsertQuery = `
        INSERT INTO transactions(user_id, total_amount, type, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      // The description can be the name of the first item, for simplicity
      const transactionValues = [userId, totalAmount, type, items[0].item_name];
      const transactionResult = await client.query(transactionInsertQuery, transactionValues);
      const transactionId = transactionResult.rows[0].id;

      // 2. Insert each item into the 'transaction_items' table
      const itemInsertQuery = `
        INSERT INTO transaction_items(transaction_id, item_name, quantity, price_per_item)
        VALUES ($1, $2, $3, $4);
      `;

      // Loop through all items and execute the insert query for each
      for (const item of items) {
        const itemValues = [transactionId, item.item_name, item.quantity, item.price_per_item];
        await client.query(itemInsertQuery, itemValues);
      }

      // If all queries were successful, commit the transaction
      await client.query('COMMIT');
      console.log('Transaction committed successfully!');
      return { success: true, transactionId: transactionId };
    } catch (e) {
      // If any query fails, roll back the entire transaction
      await client.query('ROLLBACK');
      console.error('Error in transaction, rolling back!', e);
      throw e; // Re-throw the error to be handled by the caller
    } finally {
      // ALWAYS release the client back to the pool
      client.release();
    }
  },
};
