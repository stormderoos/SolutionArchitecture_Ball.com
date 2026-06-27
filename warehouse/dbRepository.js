const db = require("./db");

module.exports = {
    // Database functions
    // Create a pick list
    async createPickList(pickList) {
        // Create a pick list
        const [result] = await db.query(
            "INSERT INTO PickList (pickListId, productId, amount) VALUES (?, ?)",
            [pickList.pickListId, pickList.productId, pickList.amount,]
        );

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
