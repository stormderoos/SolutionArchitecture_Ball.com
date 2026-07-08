// db.js
const mysql = require("mysql2/promise");

// The application only needs DML rights (SELECT/INSERT/UPDATE/DELETE).
// The schema, including the OrderEvents event store, is created in
// mysql/init.sql (not at runtime) to respect the principle of least privilege.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

module.exports = pool;
