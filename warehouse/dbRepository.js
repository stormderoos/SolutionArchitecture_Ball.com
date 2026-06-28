const db = require("./db");

module.exports = {
    // Database functions
    // Create a single pick list item (one product row of a pick list)
    async createPickListItem(pickListId, productId, amount) {
        // Insert the pick list row
        await db.query(
            "INSERT INTO PickList (pickListId, productId, amount) VALUES (?, ?, ?)",
            [pickListId, productId, amount]
        );

        return { pickListId, productId, amount };
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
