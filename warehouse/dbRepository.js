const db = require("./db");

module.exports = {
    // Database functions
    // Create aproduct
    async createProduct(product) {
        const [result] = await db.query(
            "INSERT INTO Product (name, description, price, manufacturer, amountStored) VALUES (?, ?, ?, ?, ?)",
            [product.name, product.description, product.price, product.manufacturer, product.amountStored]
        );

        return product;
    }
};
