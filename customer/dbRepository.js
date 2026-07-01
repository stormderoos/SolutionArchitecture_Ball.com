const db = require("./db");

module.exports = {
    // ===== Customer table =====

    // Create a customer
    async createCustomer(customer) {
        // Insert the customer
        const [result] = await db.query(
            "INSERT INTO Customer (companyName, firstName, lastName, phoneNumber, address, source) VALUES (?, ?, ?, ?, ?, ?)",
            [
                customer.companyName || null,
                customer.firstName,
                customer.lastName,
                customer.phoneNumber || null,
                customer.address || null,
                customer.source || "manual"
            ]
        );

        // Add the generated customerId to the customer object
        customer.customerId = result.insertId;

        return customer;
    },

    // Get a customer by id
    async getCustomer(customerId) {
        const [rows] = await db.query(
            "SELECT * FROM Customer WHERE customerId = ?",
            [customerId]
        );

        return rows[0] || null;
    },

    // Get all customers
    async getAllCustomers() {
        const [rows] = await db.query(
            "SELECT * FROM Customer"
        );

        return rows;
    },

    // Find a customer by the fields that come from the CSV (used to avoid duplicate imports)
    async findCustomerByImportKey(companyName, firstName, lastName, phoneNumber) {
        const [rows] = await db.query(
            "SELECT * FROM Customer WHERE companyName = ? AND firstName = ? AND lastName = ? AND phoneNumber = ?",
            [companyName, firstName, lastName, phoneNumber]
        );

        return rows[0] || null;
    },

    // Update a customer
    async updateCustomer(customer) {
        await db.query(
            "UPDATE Customer SET companyName = ?, firstName = ?, lastName = ?, phoneNumber = ?, address = ? WHERE customerId = ?",
            [
                customer.companyName || null,
                customer.firstName,
                customer.lastName,
                customer.phoneNumber || null,
                customer.address || null,
                customer.customerId
            ]
        );

        return customer;
    },

    // Delete a customer
    async deleteCustomer(customerId) {
        await db.query("DELETE FROM Customer WHERE customerId = ?", [customerId]);

        return { customerId };
    },

    //== CustomerOrder table

    // Create a local order record tied to a customer
    async createCustomerOrder(customerId, orderId, orderStatus) {
        await db.query(
            "INSERT INTO CustomerOrder (orderId, customerId, orderStatus) VALUES (?, ?, ?)",
            [orderId, customerId, orderStatus]
        );

        return { orderId, customerId, orderStatus };
    },

    // Update the status of a local order record
    async updateCustomerOrderStatus(orderId, orderStatus) {
        await db.query(
            "UPDATE CustomerOrder SET orderStatus = ? WHERE orderId = ?",
            [orderStatus, orderId]
        );

        return { orderId, orderStatus };
    },

    // Delete a local order record
    async deleteCustomerOrder(orderId) {
        await db.query("DELETE FROM CustomerOrder WHERE orderId = ?", [orderId]);

        return { orderId };
    },

    // Get all orders for a customer
    async getOrdersByCustomerId(customerId) {
        const [rows] = await db.query(
            "SELECT * FROM CustomerOrder WHERE customerId = ?",
            [customerId]
        );

        return rows;
    },

    // Get a single order by orderId
    async getCustomerOrderByOrderId(orderId) {
        const [rows] = await db.query(
            "SELECT * FROM CustomerOrder WHERE orderId = ?",
            [orderId]
        );

        return rows[0] || null;
    },

    //== Ticket table (for support questions)

    // Create support ticket
    async createTicket(ticket) {
        const date = new Date();

        const [result] = await db.query(
            "INSERT INTO Ticket (customerId, orderId, subject, message, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'open', ?, ?)",
            [
                ticket.customerId,
                ticket.orderId || null,
                ticket.subject,
                ticket.message,
                date,
                date
            ]
        );

        return { ticketId: result.insertId, ...ticket, status: "open", createdAt: date, updatedAt: date };
    },

    // Get a single ticket by id
    async getTicket(ticketId) {
        const [rows] = await db.query(
            "SELECT * FROM Ticket WHERE ticketId = ?",
            [ticketId]
        );

        return rows[0] || null;
    },

    // Get all tickets for a customer
    async getTicketsByCustomerId(customerId) {
        const [rows] = await db.query(
            "SELECT * FROM Ticket WHERE customerId = ? ORDER BY createdAt DESC",
            [customerId]
        );

        return rows;
    },

    // Get all tickets (for the service department's overview)
    async getAllTickets() {
        const [rows] = await db.query(
            "SELECT * FROM Ticket ORDER BY createdAt DESC"
        );

        return rows;
    },

    // Answer a ticket (customer service responds)
    async answerTicket(ticketId, response) {
        const date = new Date();

        await db.query(
            "UPDATE Ticket SET response = ?, status = 'answered', updatedAt = ? WHERE ticketId = ?",
            [response, date, ticketId]
        );

        return this.getTicket(ticketId);
    },

    // Close ticket
    async closeTicket(ticketId) {
        const date = new Date();

        await db.query(
            "UPDATE Ticket SET status = 'closed', updatedAt = ? WHERE ticketId = ?",
            [date, ticketId]
        );

        return this.getTicket(ticketId);
    },

    //==EventLogs table

    async createEventLog(eventLog) {
        const [result] = await db.query(
            "INSERT INTO EventLogs (name, description, date) VALUES (?, ?, ?)",
            [eventLog.name, eventLog.description, eventLog.date]
        );

        return { eventLogsId: result.insertId, ...eventLog };
    },

    async getEventLogs() {
        const [rows] = await db.query("SELECT * FROM EventLogs ORDER BY date DESC");

        return rows;
    }
};