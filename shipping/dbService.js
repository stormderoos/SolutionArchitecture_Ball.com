const db = require("./dbRepository");
const crypto = require("crypto");

module.exports = {
    // Carrier

    // Get all carriers
    async getAllCarriers() {
        try {
            return await db.getAllCarriers();
        } catch (error) {
            console.error("Error getting carriers:", error);
            throw error;
        }
    },

    // Pick cheapest carrier
    // getAllCarriers() already orders by pricePerShipment
    // so the first row is always the cheapest one ([0]) 
    async pickCheapestCarrier() {
        try {
            const carriers = await db.getAllCarriers();

            if (!carriers || carriers.length === 0) {
                throw new Error("No carriers available in the database.");
            }

            const cheapest = carriers[0];
            console.log(`[ShippingService] Cheapest carrier: ${cheapest.name} at €${cheapest.pricePerShipment}`);

            return cheapest;
        } catch (error) {
            console.error("Error picking cheapest carrier:", error);
            throw error;
        }
    },

    // Shipment

    // Create new shipment for incoming order.
    // pick the cheapest carrier, generate tracking code,
    // saves the shipment, and returns it so the caller can
    // publish a status update back to Order management.
    async createShipment(orderId, customerId) {
        try {
            // Pick the cheapest carrier
            const carrier = await this.pickCheapestCarrier();

            // Generate a tracking code:
            const trackingCode = "SHIPMENT-" + crypto.randomUUID().replace(/-/g, "").substring(0, 10).toUpperCase();

            // Create the shipment record
            const shipment = await db.createShipment({
                orderId,
                customerId,
                carrierId: carrier.carrierId,
                status: "Pending",
                trackingCode
            });

            console.log(`[ShippingService] Created shipment ${shipment.shipmentId} for order ${orderId} with carrier ${carrier.name} (tracking: ${trackingCode})`);

            return { shipment, carrier };
        } catch (error) {
            console.error("Error creating shipment:", error);
            throw error;
        }
    },

    // Get a single shipment
    async getShipment(shipmentId) {
        try {
            return await db.getShipment(shipmentId);
        } catch (error) {
            console.error("Error getting shipment:", error);
            throw error;
        }
    },

    // Get all shipments
    async getAllShipments() {
        try {
            return await db.getAllShipments();
        } catch (error) {
            console.error("Error getting shipments:", error);
            throw error;
        }
    },

    // Get shipment by order id
    async getShipmentByOrderId(orderId) {
        try {
            return await db.getShipmentByOrderId(orderId);
        } catch (error) {
            console.error("Error getting shipment by order id:", error);
            throw error;
        }
    },

    // Update status of shipment
    async updateShipmentStatus(shipmentId, status) {
        try {
            return await db.updateShipmentStatus(shipmentId, status);
        } catch (error) {
            console.error("Error updating shipment status:", error);
            throw error;
        }
    },

    // EventLogs

    async createEventLog(eventLog) {
        try {
            return await db.createEventLog(eventLog);
        } catch (error) {
            console.error("Error creating event log:", error);
            throw error;
        }
    },

    async getEventLogs() {
        try {
            return await db.getEventLogs();
        } catch (error) {
            console.error("Error getting event logs:", error);
            throw error;
        }
    }
};