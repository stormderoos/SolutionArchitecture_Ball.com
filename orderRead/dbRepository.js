const db = require("./db");

module.exports = {
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
    }
};
