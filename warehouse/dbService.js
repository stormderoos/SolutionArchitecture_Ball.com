const db = require("./dbRepository");

module.exports = {
    // Functions
    // Create a product
    async createProduct(request) {
        db.createProduct(request.product)
        return request.product;
    }
};
