const db = require("./dbRepository");

module.exports = {
    // Functions
    // Create a pick list
    async createPickList(orderId, productsToPick) {
        try {
            let picks = [];

            // Create a pick list for all the products
            for (const ptp of productsToPick) {
                picks.push(await db.createPickListItem(orderId, ptp.productId, ptp.amount));
            }

            return picks;
        } catch (error) {
            console.error("Error creating order:", error);
            throw error;
        }
    },

    // Update pick list
    async updatePickList(orderId, productsToPick) {
        let picks = [];

        for (const ptp of productsToPick) {
            // Get the product to pick
            const product = await db.getPickList(orderId, ptp.productId);

            // Create or update the product to pick
            if (product === null) {
                picks.push(await db.createPickList(orderId, ptp.productId, ptp.amount));
            } else {
                picks.push(await db.updatePickList(orderId, ptp.productId, ptp.amount));
            }
        }

        return picks;
    },

    // Create a package
    async createPackage(orderId) {
        return db.createPackage(orderId);
    }
};
