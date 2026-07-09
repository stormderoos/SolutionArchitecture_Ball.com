const db = require("./db");

module.exports = {
    // Database functions
    // Create a order
    async createOrder(order) {
        const orderStatus = "Order created";

        // Create the order (write-side snapshot). Generate the id if the caller
        // didn't provide one, so the aggregate always has an identity.
        if (order.orderId) {
            await db.query(
                "INSERT INTO Orders (orderId, orderStatus, customerId) VALUES (?, ?, ?)",
                [order.orderId, orderStatus, order.customerId]
            );
        } else {
            const [result] = await db.query(
                "INSERT INTO Orders (orderStatus, customerId) VALUES (?, ?)",
                [orderStatus, order.customerId]
            );
            order.orderId = result.insertId;
        }

        // Expose the initial status so callers (and the published order_created
        // event) carry it into the read model instead of leaving it null.
        order.orderStatus = orderStatus;

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
            "INSERT INTO EventLogs (type, name, description, date, data) VALUES (?, ?, ?, ?, ?)",
            [eventLog.type, eventLog.name, eventLog.description, eventLog.date, JSON.stringify(eventLog.data)]
        );

        // Add the generated eventLogsId to the eventLog object
        eventLog.eventLogsId = result.insertId;

        return eventLog;
    },

    // Get all events
    async getAllEvents() {
        const [rows] = await db.query(
            "SELECT * FROM EventLogs"
        );

        return rows;
    },

    // Event sourcing: append an immutable event to the order event store.
    // OrderEvents is the SOURCE OF TRUTH; the Orders table is only a snapshot.
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
    },

    // Event sourcing: the full, ordered event stream across ALL orders.
    // Used to replay every event so a downstream read model can be rebuilt
    // from scratch, purely from the event store.
    async getAllOrderEvents() {
        const [rows] = await db.query(
            "SELECT * FROM OrderEvents ORDER BY eventId ASC"
        );

        return rows;
    }
};
