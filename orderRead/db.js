// db.js
const mysql = require("mysql2/promise");

// The application only needs DML rights. The read model schema lives in
// mysql/init.sql (the Orders table in OrderServiceReadDB), not created at
// runtime, to respect the principle of least privilege.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

module.exports = pool;
