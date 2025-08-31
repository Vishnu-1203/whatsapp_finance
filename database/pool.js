const {Pool}=require("pg");
// The require('dotenv').config() call should be in your main application
// entry point (e.g., server.js or test-db.js), not here.

// The 'pg' library is smart! If you use the standard PG* environment variables
// (like PGUSER, PGPASSWORD, etc.) in your .env file, you don't need to pass
// any configuration object to the Pool constructor. It finds them automatically.
const pool = new Pool();
console.log('Database pool created.');

module.exports=pool;