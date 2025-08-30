const {Pool}=require("pg");
require("dotenv").config();

console.log(process.env.DB_USER+"User pooled(logged)")
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: 5432
});

module.exports=pool;