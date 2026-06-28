const db = require("./dbRepository");

module.exports = {
    // Functions
    // Process a payment for an order (forward- or after-pay)
    async processPayment(order, products) {
        try {
            // Determine the payment method (default: forward-pay)
            const method = order.paymentMethod === "after" ? "after" : "forward";

            // NOTE: prices live in the warehouse service (decentralized data), so for now
            // the amount is a placeholder based on the number of ordered items.
            const amount = (products || []).reduce((sum, p) => sum + (p.amount || 0), 0);

            // Forward-pay is settled immediately; after-pay is invoiced (still "Paid" for the demo).
            const status = "Paid";

            const payment = await db.createPayment({
                orderId: order.orderId,
                customerId: order.customerId,
                method,
                amount,
                status,
                date: new Date()
            });

            return payment;
        } catch (error) {
            console.error("Error processing payment:", error);
            throw error;
        }
    },

    // Get a payment by order id
    async getPaymentByOrderId(orderId) {
        try {
            return await db.getPaymentByOrderId(orderId);
        } catch (error) {
            console.error("Error getting payment:", error);
            throw error;
        }
    },

    // Get all payments
    async getPayments() {
        try {
            return await db.getPayments();
        } catch (error) {
            console.error("Error getting payments:", error);
            throw error;
        }
    },

    // Delete a payment for an order
    async deletePayment(orderId) {
        try {
            return await db.deletePaymentByOrderId(orderId);
        } catch (error) {
            console.error("Error deleting payment:", error);
            throw error;
        }
    }
};
