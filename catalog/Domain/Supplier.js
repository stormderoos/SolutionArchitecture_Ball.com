class Supplier {
    static get allowedFields() {
        return ["name", "products"];
    }

    constructor({ supplierId, name, products = [] }) {
        this.supplierId = supplierId ?? null;
        this.name = name;
        this.products = Array.isArray(products) ? products : [];
    }

    static fromPayload(payload) {
        return new Supplier(payload || {});
    }
}

module.exports = Supplier;
