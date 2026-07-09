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

    async getEvents() {
        try {
            return await db.getEvents();
        } catch (error) {
            console.error("Error getting events:", error);
            throw error;
        }
    },

    // ---- CQRS projections (update the read model from order events) ----
    // Idempotent: an order event may be delivered more than once (at-least-once).
    async projectOrderCreated(data, meta = {}) {
        const result = await db.upsertOrder(data.orderId, data.customerId, data.orderStatus);
        await db.appendEvent({
            eventType: "order_created",
            eventName: "Order created",
            orderId: data.orderId,
            customerId: data.customerId,
            orderStatus: data.orderStatus,
            meta,
            payload: data
        });
        return result;
    },

    async projectOrderUpdated(data, meta = {}) {
        const result = await db.upsertOrder(data.orderId, data.customerId, data.orderStatus);
        await db.appendEvent({
            eventType: "order_updated",
            eventName: "Order updated",
            orderId: data.orderId,
            customerId: data.customerId,
            orderStatus: data.orderStatus,
            meta,
            payload: data
        });
        return result;
    },

    async projectStatusChanged(data, meta = {}) {
        const result = await db.updateOrderStatus({ orderId: data.orderId, orderStatus: data.orderStatus });
        await db.appendEvent({
            eventType: "order_status_updated",
            eventName: "Order status updated",
            orderId: data.orderId,
            orderStatus: data.orderStatus,
            meta,
            payload: data
        });
        return result;
    },

    async projectOrderDeleted(data, meta = {}) {
        const result = await db.deleteOrder(data.orderId);
        await db.appendEvent({
            eventType: "order_deleted",
            eventName: "Order deleted",
            orderId: data.orderId,
            meta,
            payload: data
        });
        return result;
    }
};
