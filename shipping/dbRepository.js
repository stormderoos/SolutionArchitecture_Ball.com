const db = require("./db");

module.exports = {
    // Carrier table

    // Get all carriers
    async getAllCarriers() {
        const [rows] = await db.query(
            "SELECT * FROM Carrier ORDER BY pricePerShipment ASC"
        );

        return rows;
    },

    // Get a single carrier by id
    async getCarrier(carrierId) {
        const [rows] = await db.query(
            "SELECT * FROM Carrier WHERE carrierId = ?",
            [carrierId]
        );

        return rows[0] || null;
    },

    // Shipment

    // Create a shipment
    async createShipment(shipment) {
        const [result] = await db.query(
            "INSERT INTO Shipment (orderId, customerId, carrierId, status, trackingCode, packageWeight, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                shipment.orderId,
                shipment.customerId,
                shipment.carrierId,
                shipment.status,
                shipment.trackingCode,
                shipment.packageWeight || null,
                new Date()
            ]
        );

        return { shipmentId: result.insertId, ...shipment };
    },

    // Get shipment by id
    async getShipment(shipmentId) {
        const [rows] = await db.query(
            "SELECT * FROM Shipment WHERE shipmentId = ?",
            [shipmentId]
        );

        return rows[0] || null;
    },

    // Get all shipments
    async getAllShipments() {
        const [rows] = await db.query(
            "SELECT * FROM Shipment ORDER BY createdAt DESC"
        );

        return rows;
    },

    // Get a shipment by order id 
    async getShipmentByOrderId(orderId) {
        const [rows] = await db.query(
            "SELECT * FROM Shipment WHERE orderId = ?",
            [orderId]
        );

        return rows[0] || null;
    },

    // Update status of shipment (eg. pending > shipped)
    async updateShipmentStatus(shipmentId, status) {
        const shippedAt = status === "Shipped" ? new Date() : null;

        await db.query(
            "UPDATE Shipment SET status = ?, shippedAt = COALESCE(?, shippedAt) WHERE shipmentId = ?",
            [status, shippedAt, shipmentId]
        );

        return this.getShipment(shipmentId);
    },

    // EventLogs

    async createEventLog(eventLog) {
        const [result] = await db.query(
            "INSERT INTO EventLogs (name, description, date) VALUES (?, ?, ?)",
            [eventLog.name, eventLog.description, eventLog.date]
        );

        return { eventLogsId: result.insertId, ...eventLog };
    },

    async getEventLogs() {
        const [rows] = await db.query(
            "SELECT * FROM EventLogs ORDER BY date DESC"
        );

        return rows;
    }
};