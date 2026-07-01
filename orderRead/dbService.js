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
    },

    // CQRS projection: apply an OrderCreated event to the read model
    async projectOrderCreated(orderId, customerId, orderStatus) {
        try {
            return await db.projectOrderCreated(orderId, customerId, orderStatus);
        } catch (error) {
            console.error("Error projecting order created:", error);
            throw error;
        }
    },

    // CQRS projection: apply an OrderStatusChanged event to the read model
    async projectStatusChanged(orderId, orderStatus) {
        try {
            return await db.projectStatusChanged(orderId, orderStatus);
        } catch (error) {
            console.error("Error projecting status change:", error);
            throw error;
        }
    },

    // Event sourcing: read the event stream for an order and rebuild its current
    // state purely by replaying the events (the events are the source of truth).
    async getOrderHistory(orderId) {
        try {
            const events = await db.getOrderEvents(orderId);

            let state = null;
            for (const ev of events) {
                const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;

                if (ev.eventType === "OrderCreated") {
                    state = { orderId: ev.orderId, customerId: data.customerId, orderStatus: data.orderStatus };
                } else if (ev.eventType === "OrderStatusChanged" && state) {
                    state.orderStatus = data.orderStatus;
                }
            }

            return {
                orderId: Number(orderId),
                eventCount: events.length,
                reconstructedState: state,
                events
            };
        } catch (error) {
            console.error("Error getting order history:", error);
            throw error;
        }
    }
};
