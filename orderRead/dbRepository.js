const db = require("./db");

module.exports = {
    async ensureEventStoreTable() {
        await db.query(`
            CREATE TABLE IF NOT EXISTS EventStore (
                eventId INT AUTO_INCREMENT PRIMARY KEY,
                eventType VARCHAR(100) NOT NULL,
                eventName VARCHAR(100),
                orderId INT,
                customerId INT,
                orderStatus VARCHAR(100),
                meta JSON,
                payload JSON,
                createdAt DATETIME NOT NULL
            )
        `);
    },

    // Database functions
    // CQRS read model: queries read from the projection that is built from events,
    // NOT from the write-side Orders table.
    async getOrder(orderId) {
        const [rows] = await db.query(
            "SELECT * FROM Orders WHERE orderId = ?",
            [orderId]
        );

        return rows[0];
    },

    // Get all orders (from the read model)
    async getAllOrders() {
        const [rows] = await db.query(
            "SELECT * FROM Orders"
        );

        return rows;
    },

    // Delete a order
    async deleteOrder(orderId) {
        // Delete a order
        await db.query("DELETE FROM Orders WHERE orderId = ?",
            [orderId]
        );

        return true;
    },

    // Update a order
    async updateOrder(order) {
        // Update a order
        await db.query(
            "UPDATE Orders SET orderStatus = ?, customerId = ? WHERE orderId = ?",
            [order.orderStatus, order.customerId, order.orderId]
        );

        return order;
    },

    // Update a order status
    async updateOrderStatus(order) {
        // Update a order status
        await db.query(
            "UPDATE Orders SET orderStatus = ? WHERE orderId = ?",
            [order.orderStatus, order.orderId]
        );

        return order;
    },

    // Insert or update an order in the read model. Idempotent, because an event
    // may be delivered more than once (RabbitMQ is at-least-once).
    async upsertOrder(orderId, customerId, orderStatus) {
        await db.query(
            "INSERT INTO Orders (orderId, customerId, orderStatus) VALUES (?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE customerId = VALUES(customerId), orderStatus = VALUES(orderStatus)",
            [orderId, customerId, orderStatus]
        );

        return { orderId, customerId, orderStatus };
    },

    // Create a order
    async createOrder(order) {
        const orderStatus = "Order created";

        // Creare the order
        const [result] = await db.query(
            "INSERT INTO Orders (orderId, orderStatus, customerId) VALUES (?, ?, ?)",
            [order.orderId, orderStatus, order.customerId]
        );

        // Full created order to return
        data = {
            orderId: order.orderId,
            orderStatus: orderStatus,
            customerId: order.customerId
        }

        return data;
    },

    async appendEvent(event) {
        await this.ensureEventStoreTable();

        const [result] = await db.query(
            "INSERT INTO EventStore (eventType, eventName, orderId, customerId, orderStatus, meta, payload, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                event.eventType,
                event.eventName,
                event.orderId ?? null,
                event.customerId ?? null,
                event.orderStatus ?? null,
                JSON.stringify(event.meta ?? {}),
                JSON.stringify(event.payload ?? {}),
                event.createdAt || new Date()
            ]
        );

        return { eventId: result.insertId, ...event };
    },

    async getEvents() {
        await this.ensureEventStoreTable();

        const [rows] = await db.query(
            "SELECT * FROM EventStore ORDER BY createdAt DESC, eventId DESC"
        );

        return rows.map((row) => ({
            ...row,
            meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
            payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload
        }));
    }
};
