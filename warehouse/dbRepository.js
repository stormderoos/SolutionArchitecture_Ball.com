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

        // Created pick list to return
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
    },

    // Get one pick list
    async getPickList(orderId, productId) {
        // Get all pick lists
        const [rows] = await db.query(
            "SELECT * FROM PickList WHERE productId = ? AND orderId = ?",
            [productId, orderId]
        );

        return rows[0];
    },

    // Update pick list
    async updatePickList(orderId, productId, amount) {
        const [result] = await db.query(
            "UPDATE PickList SET amount = ? WHERE productId = ? AND orderId = ?",
            [amount, productId, orderId]
        );

        // Updated pick list to return
        const data = {
            orderId: orderId,
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
    },

    // Insert or update a product replica coming from the Catalog (the upstream
    // owner of products). Keyed on the Catalog productId so PickList can reference
    // it. On update we only sync name and price and leave the local stock intact.
    async upsertProduct(product) {
        await db.query(
            "INSERT INTO Product (productId, name, description, price, manufacturer, amountStored) " +
            "VALUES (?, ?, ?, ?, ?, ?) " +
            "ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price)",
            [
                product.productId,
                product.name,
                product.description ?? null,
                product.price ?? 0,
                product.manufacturer ?? null,
                product.amountStored ?? 0
            ]
        );

        return { productId: product.productId, name: product.name, price: product.price ?? 0 };
    }
};
