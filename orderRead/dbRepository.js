const db = require("./db");

module.exports = {
    // Database functions
    // CQRS read model: queries read from the projection that is built from events,
    // NOT from the write-side Orders table.
    async getOrder(orderId) {
        const [rows] = await db.query(
            "SELECT * FROM OrderReadModel WHERE orderId = ?",
            [orderId]
        );

        return rows[0];
    },

    // Get all orders (from the read model)
    async getAllOrders() {
        const [rows] = await db.query(
            "SELECT * FROM OrderReadModel"
        );

        return rows;
    },

    // Project an OrderCreated event into the read model (insert the order)
    async projectOrderCreated(orderId, customerId, orderStatus) {
        await db.query(
            "INSERT INTO OrderReadModel (orderId, customerId, orderStatus, updatedAt) VALUES (?, ?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE customerId = VALUES(customerId), orderStatus = VALUES(orderStatus), updatedAt = VALUES(updatedAt)",
            [orderId, customerId, orderStatus, new Date()]
        );
    },

    // Project an OrderStatusChanged event into the read model (update the status)
    async projectStatusChanged(orderId, orderStatus) {
        await db.query(
            "INSERT INTO OrderReadModel (orderId, orderStatus, updatedAt) VALUES (?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE orderStatus = VALUES(orderStatus), updatedAt = VALUES(updatedAt)",
            [orderId, orderStatus, new Date()]
        );
    },

    // Get all event logs
    async getEventLogs() {
        const [rows] = await db.query(
            "SELECT * FROM EventLogs"
        );

        return rows;
    },

    // Event sourcing: get the full, ordered event stream for one order.
    async getOrderEvents(orderId) {
        const [rows] = await db.query(
            "SELECT * FROM OrderEvents WHERE orderId = ? ORDER BY eventId ASC",
            [orderId]
        );

        return rows;
    }
};
