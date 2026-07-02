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

    // Create an order
    async createOrder(order) {
        return await db.createOrder(order);
    },

    // Updete an order
    async updateOrder(order) {
        return await db.updateOrder(order);
    },

    // Handel incoming event
    async handelEvent(event) {
        console.log(`[OrderReadService] Handel event: ${event.name}`)
        if (event.type.includes("Create") && event.name.includes("order")) {
            console.log(`[OrderReadService] Create order: ${event.data}`)
            return await db.createOrder({
                orderId: event.data.orderId,
                orderStatus: event.data.orderStatus,
                customerId: event.data.customerId
            });
        } else if (event.type.includes("Update") && event.name.includes("order")) {
            console.log(`[OrderReadService] Update order: ${event.data}`)
            // If there is no customer id than only update the status
            if (event.data.customerId === null || event.data.customerId === undefined) {
                console.log(`[OrderReadService] Update status`)
                return await db.updateOrderStatus({
                    orderId: event.data.orderId,
                    orderStatus: event.data.orderStatus
                });
            } else {
                console.log(`[OrderReadService] Update order`)
                return await db.updateOrder({
                    orderId: event.data.orderId,
                    orderStatus: event.data.orderStatus,
                    customerId: event.data.customerId
                });
            }
        } else if (event.type.includes("Delete") && event.name.includes("order")) {
            console.log(`[OrderReadService] Delete order: ${event.data}`)
            return await db.deleteOrder(event.data.orderId);
        }
    }
};
