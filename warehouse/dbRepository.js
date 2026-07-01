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
    },

    // Get one pick list
    async getPickList(pickListId, productId) {
        // Get all pick lists
        const [rows] = await db.query(
            "SELECT * FROM PickList WHERE productId = ? AND pickListId = ?",
            [productId, pickListId]
        );

        return rows[0];
    },

    // Update pick list
    async updatePickList(pickListId, productId, amount) {
        const [result] = await db.query(
            "UPDATE PickList SET amount = ? WHERE productId = ? AND pickListId = ?",
            [amount, productId, pickListId]
        );

        // Updated pick list to return
        const data = {
            pickListId: pickListId,
            productId: productId,
            amount: amount
        }

        return data;
    },

    // Create a package
    async createPackage(orderId) {
        const packageStatus = "Products picked"
        // Create package
        const [result] = await db.query(
            "INSERT INTO Package (packageStatus, orderId) VALUES (?, ?)",
            [packageStatus, orderId]
        );

        // Full created package to return
        data = {
            packageId: result.insertId,
            orderId: orderId,
            packageStatus: packageStatus
        }

        return data;
    }
};
