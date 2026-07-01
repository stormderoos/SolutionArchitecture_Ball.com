const db = require("./db");

module.exports = {
    // Database functions
    // Get a order
    async getOrder(orderId) {
        // Get a order
        const [rows] = await db.query(
            "SELECT * FROM Orders WHERE orderId = ?",
            [orderId]
        );

        return rows[0];
    },

    // Get all orders
    async getAllOrders() {
        // Get all orders
        const [rows] = await db.query(
            "SELECT * FROM Orders",
        );

        return rows;
    },

   // Get all event logs
    async getEventLogs() {
        // Get all event logs
        const [rows] = await db.query(
            "SELECT * FROM EventLogs"
        );

        return rows;
    }
};
