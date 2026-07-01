const db = require("./db");

module.exports = {
    // Database functions
    // Create a order
    async createOrder(order) {
        const orderStatus = "Order created";

        // Creare the order
        const [result] = await db.query(
            "INSERT INTO Orders (orderStatus, customerId) VALUES (?, ?)",
            [orderStatus, order.customerId]
        );

        // Full created order to return
        data = {
            orderId: result.insertId,
            orderStatus: orderStatus,
            customerId: order.customerId
        }

        return data;
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
    async updateOrderStatus(orderId, orderStatus) {
        // Update a order status
        await db.query(
            "UPDATE Orders SET orderStatus = ? WHERE orderId = ?",
            [orderStatus, orderId]
        );

        // Return updated order fields
        return {
            orderId,
            orderStatus
        };
    },

    // Get a single order (used to read the current status before updating it)
    async getOrder(orderId) {
        const [rows] = await db.query(
            "SELECT * FROM Orders WHERE orderId = ?",
            [orderId]
        );

        return rows[0] || null;
    },

    // Delete a order
    async deleteOrder(orderId) {
        // Delete a order
        await db.query("DELETE FROM Orders WHERE orderId = ?",
            [orderId]
        );
        return true;
    },

    // Get orders by customer id
    async getOrdersByCustomerId(customerId) {
        // Get a order
        const [rows] = await db.query(
            "SELECT * FROM Orders WHERE customerId = ?",
            [costumerId]
        );

        return rows;
    },

    // Create a customer
    async createCustomer(customer) {
        // Create the costumer
        const [result] = await db.query(
            "INSERT INTO Customer (address, zipCode, email) VALUES (?, ?, ?)",
            [customer.address, customer.zipCode, customer.email]
        );

        // Add the generated customerId to the customer object
        customer.customerId = result.insertId;

        return customer;
    },

    // Update a customer
    async updateCustomer(customer) {
        // Update the customer
        const [result] = await db.query(
            "UPDATE Customer SET address = ?, zipCode = ?, email = ? WHERE customerId = ?",
            [customer.address, customer.zipCode, customer.email, customer.customerId]
        );

        return customer;
    },

    // Delete a customer
    async deleteCustomer(customerId) {
        // Delete a costumer
        await db.query("DELETE FROM Customer WHERE customerId = ?",
            [customerId]
        );

        return true;
    },

    // Create a product
    async createProduct(product) {
        // Creare the product
        const [result] = await db.query(
            "INSERT INTO Product (name, description) VALUES (?, ?)",
            [product.name, product.description]
        );

        // Add the generated productId to the product object
        product.productId = result.insertId;

        return product;
    },

    // Update a product
    async updateProduct(product) {
        // Update the product
        await db.query(
            "UPDATE Product SET name = ?, description = ? WHERE productId = ?",
            [product.name, product.description, product.productId]
        );

        return product;
    },

    // Insert or update a product replica coming from the Catalog (the upstream
    // owner of products). Keyed on the Catalog productId so this local copy keeps
    // the SAME identity, which OrderProduct references. Idempotent.
    async upsertProduct(product) {
        await db.query(
            "INSERT INTO Product (productId, name, description) VALUES (?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)",
            [product.productId, product.name, product.description ?? null]
        );

        return { productId: product.productId, name: product.name, description: product.description ?? null };
    },

    // Delete a product
    async deleteProduct(productId) {
        // Delete a product
        await db.query("DELETE FROM Product WHERE productId = ?",
            [productId]
        );

        return true;
    },

    // Create order product connection
    async createOrderProduct(orderId, productId, amount) {
        // Create oreder product
        const [result] = await db.query(
            "INSERT INTO OrderProduct (orderId, productId, amount) VALUES (?, ?, ?)",
            [orderId, productId, amount]
        );
    },

    // Update order product connection
    async updateOrderProduct(orderId, productId, amount) {
        // Update oreder product
        const [result] = await db.query(
            "UPDATE OrderProduct SET amount = ? WHERE productId = ? AND orderId = ?",
            [amount, productId, orderId]
        );
    },

    // Delete order product connection
    async deleteOrderProduct(orderId, productId) {
        // Delete oreder product
        const [result] = await db.query(
            "DELETE FROM OrderProduct WHERE orderId = ? AND productId = ?",
            [orderId, productId]
        );

        return true;
    },

    // Get order products connection
    async getOrderProduct(orderId, productId) {
        // Get oreder product
        const [rows] = await db.query(
            "SELECT * FROM OrderProduct WHERE orderId = ? AND productId = ?",
            [orderId, productId]
        );

        return rows[0];
    },

    // Get order products connection by order id
    async getOrderProductsByOrderId(orderId) {
        // Get order products
        const [rows] = await db.query(
            "SELECT * FROM OrderProduct WHERE orderId = ?",
            [orderId]
        );

        return rows;
    },

    // Get order products connection by product id
    async getOrderProductsByProductId(productId) {
        // Get oreder product
        const [rows] = await db.query(
            "SELECT * FROM OrderProduct WHERE productId = ?",
            [productId]
        );

        return rows;
    },

    // Create a event log
    async createEventLog(eventLog) {
        // Create the event log
        const [result] = await db.query(
            "INSERT INTO EventLogs (name, description, date) VALUES (?, ?, ?)",
            [eventLog.name, eventLog.description, eventLog.date]
        );

        // Add the generated eventLogsId to the eventLog object
        eventLog.eventLogsId = result.insertId;

        return eventLog;
    },

    // Event sourcing: append an event to the append-only order event store.
    // These events are the source of truth from which the order state is rebuilt.
    async appendOrderEvent(orderId, eventType, data) {
        await db.query(
            "INSERT INTO OrderEvents (orderId, eventType, data, createdAt) VALUES (?, ?, ?, ?)",
            [orderId, eventType, JSON.stringify(data ?? {}), new Date()]
        );
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
