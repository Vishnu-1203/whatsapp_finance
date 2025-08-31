const {Pool}=require("pg");

// By explicitly loading dotenv here, we ensure the correct database is always
// used. This is the most robust way to configure the connection and will
// fix the "relation 'users' does not exist" error.
require('dotenv').config();

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT, 10) // It's best practice to parse the port to an integer
});

console.log('Database pool created.');

module.exports=pool;