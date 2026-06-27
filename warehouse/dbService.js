const db = require("./dbRepository");

module.exports = {
    // Functions
    // Create a pick list
    async createPickList(orderId, productsToPick) {
        try {
            let picks = [];

            // Create a pick list for all the products
            for (const ptp of productsToPick) {
                picks.push(await db.createOrderProduct(orderId, ptp.productId, ptp.amount));
            }

            return picks;
        } catch (error) {
            console.error("Error creating order:", error);
            throw error;
        }
    },
};
