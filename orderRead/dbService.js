const db = require("./dbRepository");

module.exports = {
    // Get an order
    async getOrder(orderId) {
        try {
            return await db.getOrder(orderId);
        } catch (error) {
            console.error("Error getting order:", error);
            throw error;
        }
    },

    // Get all orders
    async getAllOrders() {
        try {
            return await db.getAllOrders();
        } catch (error) {
            console.error("Error getting order:", error);
            throw error;
        }
    },

    // Get all event logs
    async getEventLogs() {
        try {
            return await db.getEventLogs();
        } catch (error) {
            console.error("Error getting event logs:", error);
            throw error;
        }
    }
};
