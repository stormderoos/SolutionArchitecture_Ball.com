// db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// Ensure the append-only event store exists (event sourcing). Created at startup
// so the running stack doesn't need a database reset. Retries until MySQL is up.
async function ensureEventStore() {
    for (let attempt = 1; attempt <= 20; attempt++) {
        try {
            await pool.query(
                `CREATE TABLE IF NOT EXISTS OrderEvents (
                    eventId INT AUTO_INCREMENT PRIMARY KEY,
                    orderId INT NOT NULL,
                    eventType VARCHAR(50) NOT NULL,
                    data JSON,
                    createdAt DATETIME NOT NULL
                )`
            );
            console.log("[EventStore] OrderEvents table ready");
            return;
        } catch (err) {
            console.log(`[EventStore] DB not ready (attempt ${attempt}), retrying in 3s...`);
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
}
ensureEventStore();

module.exports = pool;
