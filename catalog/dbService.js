const db = require("./dbRepository");

module.exports = {
    async getAllProducts() {
        return db.getAllProducts();
    },

    async getAllSuppliersWithProducts() {
        return db.getAllSuppliersWithProducts();
    },

    async createProduct(product) {
        if (!product || !product.name) {
            throw new Error("Product name is required");
        }
        return db.createProduct(product);
    },

    async createSupplier(supplier) {
        if (!supplier || !supplier.name) {
            throw new Error("Supplier name is required");
        }

        const productIds = Array.isArray(supplier.products) ? supplier.products : [];

        for (const productId of productIds) {
            if (!db.getProductById(productId)) {
                throw new Error(`Product id ${productId} does not exist`);
            }
        }

        return db.createSupplier(supplier, productIds);
    }
};
