const products = [];
const suppliers = [];
const supplierProducts = [];
let nextProductId = 1;
let nextSupplierId = 1;

function supplierExists(supplierId) {
    return suppliers.some((supplier) => supplier.supplierId === Number(supplierId));
}

function createProduct(product, supplierId) {
    if (!supplierExists(supplierId)) {
        throw new Error(`Supplier id ${supplierId} does not exist`);
    }

    const newProduct = {
        productId: nextProductId++,
        name: product.name,
        price: Number(product.price) || 0,
        weight: Number(product.weight) || 0
    };

    products.push(newProduct);
    supplierProducts.push({ supplierId: Number(supplierId), productId: newProduct.productId });
    return newProduct;
}

function getProductById(productId) {
    return products.find((product) => product.productId === Number(productId)) || null;
}

function getAllProducts() {
    return products.map((product) => ({ ...product }));
}

function updateProduct(productId, updates) {
    const existingProduct = getProductById(productId);
    if (!existingProduct) {
        throw new Error(`Product id ${productId} does not exist`);
    }

    if (updates.name !== undefined) existingProduct.name = updates.name;
    if (updates.price !== undefined) existingProduct.price = Number(updates.price) || 0;
    if (updates.weight !== undefined) existingProduct.weight = Number(updates.weight) || 0;

    return { ...existingProduct };
}

function createSupplier(supplier, productIds = []) {
    const newSupplier = {
        supplierId: nextSupplierId++,
        name: supplier.name
    };
    suppliers.push(newSupplier);

    for (const productId of productIds) {
        supplierProducts.push({ supplierId: newSupplier.supplierId, productId: Number(productId) });
    }

    return newSupplier;
}

function getSupplierProducts(supplierId) {
    const productIds = supplierProducts
        .filter((link) => link.supplierId === Number(supplierId))
        .map((link) => link.productId);

    return productIds
        .map((id) => getProductById(id))
        .filter((product) => product !== null);
}

function getAllSuppliers() {
    return suppliers.map((supplier) => ({ ...supplier }));
}

function updateSupplier(supplierId, updates) {
    const existingSupplier = suppliers.find((supplier) => supplier.supplierId === Number(supplierId));
    if (!existingSupplier) {
        throw new Error(`Supplier id ${supplierId} does not exist`);
    }

    if (updates.name !== undefined) existingSupplier.name = updates.name;

    return { ...existingSupplier };
}

function getAllSuppliersWithProducts() {
    return getAllSuppliers().map((supplier) => ({
        ...supplier,
        products: getSupplierProducts(supplier.supplierId)
    }));
}

function seedData() {
    if (products.length > 0 || suppliers.length > 0) {
        return;
    }

    const ballSupply = createSupplier({ name: "Ball Supply Co." });
    const sportingGoods = createSupplier({ name: "Sporting Goods BV" });
    const hydrationPartners = createSupplier({ name: "Hydration Partners" });

    createProduct({ name: "Ball", price: 9.99, weight: 0.25 }, ballSupply.supplierId);
    createProduct({ name: "Football", price: 12.99, weight: 0.45 }, ballSupply.supplierId);
    createProduct({ name: "Water bottle", price: 4.75, weight: 0.30 }, hydrationPartners.supplierId);
}

seedData();

module.exports = {
    createProduct,
    getProductById,
    getAllProducts,
    updateProduct,
    createSupplier,
    getAllSuppliersWithProducts,
    getAllSuppliers,
    updateSupplier,
    getSupplierProducts,
    supplierExists
};
