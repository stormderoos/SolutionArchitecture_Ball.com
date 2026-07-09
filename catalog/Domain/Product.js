class Product {
    static get allowedFields() {
        return ["name", "price", "weight", "supplierId", "description", "manufacturer", "amountStored"];
    }

    constructor({ productId, name, price, weight, supplierId, description, manufacturer, amountStored }) {
        this.productId = productId ?? null;
        this.name = name;
        this.price = Number(price) || 0;
        this.weight = Number(weight) || 0;
        this.supplierId = supplierId ?? null;
        this.description = description ?? null;
        this.manufacturer = manufacturer ?? null;
        this.amountStored = Number(amountStored) || 0;
    }

    static fromPayload(payload) {
        return new Product(payload || {});
    }
}

module.exports = Product;
