const db = require("./dbRepository");

module.exports = {
    // ---- Queries (read from the projection / read model) ----
    async getOrder(orderId) {
        try {
            return await db.getOrder(orderId);
        } catch (error) {
            console.error("Error getting order:", error);
            throw error;
        }
    },

    async getAllOrders() {
        try {
            return await db.getAllOrders();
        } catch (error) {
            console.error("Error getting orders:", error);
            throw error;
        }
    },

    // ---- CQRS projections (update the read model from order events) ----
    // Idempotent: an order event may be delivered more than once (at-least-once).
    async projectOrderCreated(data) {
        return await db.upsertOrder(data.orderId, data.customerId, data.orderStatus);
    },

    async projectOrderUpdated(data) {
        return await db.upsertOrder(data.orderId, data.customerId, data.orderStatus);
    },

    async projectStatusChanged(data) {
        return await db.updateOrderStatus({ orderId: data.orderId, orderStatus: data.orderStatus });
    },

    async projectOrderDeleted(data) {
        return await db.deleteOrder(data.orderId);
    }
};
