const db = require("./db");

module.exports = {
    // Database functions
    // Create a payment
    async createPayment(payment) {
        // Create a payment
        const [result] = await db.query(
            "INSERT INTO Payment (orderId, customerId, method, amount, status, date) VALUES (?, ?, ?, ?, ?, ?)",
            [payment.orderId, payment.customerId, payment.method, payment.amount, payment.status, payment.date]
        );

        // Add the generated paymentId to the payment object
        payment.paymentId = result.insertId;

        return payment;
    },

    // Get a payment by order id
    async getPaymentByOrderId(orderId) {
        // Get a payment
        const [rows] = await db.query(
            "SELECT * FROM Payment WHERE orderId = ?",
            [orderId]
        );

        return rows[0];
    },

    // Get all payments
    async getPayments() {
        // Get all payments
        const [rows] = await db.query(
            "SELECT * FROM Payment"
        );

        return rows;
    },

    // Update a payment status
    async updatePaymentStatus(orderId, status) {
        // Update a payment status
        await db.query(
            "UPDATE Payment SET status = ? WHERE orderId = ?",
            [status, orderId]
        );

        return true;
    },

    // Delete a payment by order id
    async deletePaymentByOrderId(orderId) {
        // Delete a payment
        await db.query(
            "DELETE FROM Payment WHERE orderId = ?",
            [orderId]
        );

        return true;
    }
};
