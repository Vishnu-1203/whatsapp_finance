// This line is crucial for a standalone test script.
// It ensures the environment variables from .env are loaded.
require('dotenv').config();

const db = require('./database/db');
const pool = require('./database/pool');

async function runTests() {
  console.log('Running database tests...');

  // Test 1: findOrCreateUserByPhone
  try {
    console.log('\n--- Testing findOrCreateUserByPhone ---');
    const testPhone = '+19999999999';

    // Run it once to create the user
    const userId1 = await db.findOrCreateUserByPhone(testPhone);
    console.log(`First call, user ID: ${userId1}`);

    // Run it a second time to find the existing user
    const userId2 = await db.findOrCreateUserByPhone(testPhone);
    console.log(`Second call, user ID: ${userId2}`);

    console.log('✅ findOrCreateUserByPhone test PASSED');
  } catch (error) {
    console.error('❌ findOrCreateUserByPhone test FAILED:', error);
  } finally {
    // End the pool so the script doesn't hang
    await pool.end();
    console.log('\nDatabase pool closed.');
  }
}

runTests();

