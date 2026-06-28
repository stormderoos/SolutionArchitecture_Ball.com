class Product {
    static get allowedFields() {
        return ["name", "price", "weight", "supplierId"];
    }

    constructor({ productId, name, price, weight, supplierId }) {
        this.productId = productId ?? null;
        this.name = name;
        this.price = Number(price) || 0;
        this.weight = Number(weight) || 0;
        this.supplierId = supplierId ?? null;
    }

    static fromPayload(payload) {
        return new Product(payload || {});
    }
}

module.exports = Product;
