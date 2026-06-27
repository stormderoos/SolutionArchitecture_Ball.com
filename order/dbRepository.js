const db = require("./db");

module.exports = {
    // Database functions
    // Create a order
    async createOrder(order) {
        // Creare the order
        const [result] = await db.query(
            "INSERT INTO Orders (orderStatus, customerId) VALUES (?, ?)",
            ["Order created", order.customerId]
        );

        // Add the generated orderId to the order object
        order.orderId = result.insertId;

        return order;
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

    // Delete a order
    async deleteOrder(orderId) {
        // Delete a order
        await db.query("DELETE FROM Orders WHERE orderId = ?",
            [orderId]
        );
        return true;
    },

    // Get a order
    async getOrder(orderId) {
        // Get a order
        const [rows] = await db.query(
            "SELECT * FROM Orders WHERE orderId = ?",
            [orderId]
        );

        return rows[0];
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

    // Get a customer
    async getCustomer(customerId) {
        // Get a costumer
        const [rows] = await db.query(
            "SELECT * FROM Customer WHERE customerId = ?",
            [customerId]
        );

        return rows[0];
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

    // Delete a product
    async deleteProduct(productId) {
        // Delete a product
        await db.query("DELETE FROM Product WHERE productId = ?",
            [productId]
        );

        return true;
    },

    // Get a product
    async getProduct(productId) {
        // Get a product
        const [rows] = await db.query(
            "SELECT * FROM Product WHERE productId = ?",
            [productId]
        );

        return rows[0];
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
        // Create oreder product
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

    // Get order products connection by order id
    async getOrderProductsByOrderId(orderId) {
        // Get oreder product
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

    // Get all event logs
    async getEventLogs() {
        // Get all event logs
        const [rows] = await db.query(
            "SELECT * FROM EventLogs",
            [eventLogId]
        );

        return rows;
    }
};
