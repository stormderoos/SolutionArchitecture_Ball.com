// db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// CQRS read model: the read side owns its OWN denormalized projection table,
// built purely from the order events it receives over the event bus. All queries
// read from this table, never from the write-side Orders table. Created at startup
// so no database reset is needed. Retries until MySQL is up.
async function ensureReadModel() {
    for (let attempt = 1; attempt <= 20; attempt++) {
        try {
            await pool.query(
                `CREATE TABLE IF NOT EXISTS OrderReadModel (
                    orderId INT PRIMARY KEY,
                    customerId INT,
                    orderStatus VARCHAR(50),
                    updatedAt DATETIME
                )`
            );
            console.log("[ReadModel] OrderReadModel table ready");
            return;
        } catch (err) {
            console.log(`[ReadModel] DB not ready (attempt ${attempt}), retrying in 3s...`);
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
}
ensureReadModel();

module.exports = pool;
