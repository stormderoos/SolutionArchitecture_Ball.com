const db = require("./db");

module.exports = {
    // Database functions
    // Create a pick list
    async createPickList(orderId, productId, amount) {
        // Create a pick list
        const [result] = await db.query(
            "INSERT INTO PickList (orderId, productId, amount) VALUES (?, ?, ?)",
            [orderId, productId, amount,]
        );

        const pickList = {
            orderId: orderId,
            productId: productId,
            amount: amount
        }

        return pickList;
    },
    // Get all pick lists
    async getPickLists() {
        // Get all pick lists
        const [rows] = await db.query(
            "SELECT * FROM PickList"
        );

        return rows;
    }
};
