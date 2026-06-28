const db = require("./dbRepository");
const Product = require("./Domain/Product");
const Supplier = require("./Domain/Supplier");

function validateAllowedFields(payload, entityClass, entityName) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error(`${entityName} data must be an object`);
    }

    const allowedFields = entityClass.allowedFields || [];
    const invalidFields = Object.keys(payload).filter((field) => !allowedFields.includes(field));
    if (invalidFields.length > 0) {
        throw new Error(`Unexpected field(s) in ${entityName} data: ${invalidFields.join(", ")}`);
    }
}

function validateProductDomain(product) {
    const productModel = Product.fromPayload(product);

    if (!productModel.name) {
        throw new Error("Product name is required");
    }

    if (!productModel.supplierId) {
        throw new Error("Product must be assigned to an existing supplier (supplierId is required)");
    }

    if (!db.supplierExists(productModel.supplierId)) {
        throw new Error(`Supplier id ${productModel.supplierId} does not exist`);
    }

    return productModel;
}

function validateSupplierDomain(supplier) {
    const supplierModel = Supplier.fromPayload(supplier);

    if (!supplierModel.name) {
        throw new Error("Supplier name is required");
    }

    return supplierModel;
}

module.exports = {
    async getAllProducts() {
        return db.getAllProducts();
    },

    async getAllSuppliersWithProducts() {
        return db.getAllSuppliersWithProducts();
    },

    async createProduct(product) {
        validateAllowedFields(product, Product, "product");

        const productModel = validateProductDomain(product);
        return db.createProduct(productModel, productModel.supplierId);
    },

    async createSupplier(supplier) {
        validateAllowedFields(supplier, Supplier, "supplier");

        const supplierModel = validateSupplierDomain(supplier);

        const productIds = Array.isArray(supplierModel.products) ? supplierModel.products : [];

        for (const productId of productIds) {
            if (!db.getProductById(productId)) {
                throw new Error(`Product id ${productId} does not exist`);
            }
        }

        return db.createSupplier(supplierModel, productIds);
    },

    async updateProduct(productId, updates) {
        if (!productId) {
            throw new Error("Product id is required");
        }

        validateAllowedFields(updates || {}, Product, "product");
        const productModel = Product.fromPayload({ productId, ...(updates || {}) });
        return db.updateProduct(productId, productModel);
    },

    async updateSupplier(supplierId, updates) {
        if (!supplierId) {
            throw new Error("Supplier id is required");
        }

        validateAllowedFields(updates || {}, Supplier, "supplier");
        const supplierModel = Supplier.fromPayload({ supplierId, ...(updates || {}) });
        return db.updateSupplier(supplierId, supplierModel);
    }
};
