const products = [];
const suppliers = [];
const supplierProducts = [];
let nextProductId = 1;
let nextSupplierId = 1;

function createProduct(product) {
    const newProduct = {
        productId: nextProductId++,
        name: product.name,
        price: Number(product.price) || 0,
        weight: Number(product.weight) || 0
    };
    products.push(newProduct);
    return newProduct;
}

function getProductById(productId) {
    return products.find((product) => product.productId === Number(productId)) || null;
}

function getAllProducts() {
    return products.map((product) => ({ ...product }));
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

    const ball = createProduct({ name: "Ball", price: 9.99, weight: 0.25 });
    const football = createProduct({ name: "Football", price: 12.99, weight: 0.45 });
    const waterBottle = createProduct({ name: "Water bottle", price: 4.75, weight: 0.30 });

    createSupplier({ name: "Ball Supply Co." }, [ball.productId, football.productId]);
    createSupplier({ name: "Sporting Goods BV" }, [football.productId]);
    createSupplier({ name: "Hydration Partners" }, [waterBottle.productId]);
}

seedData();

module.exports = {
    createProduct,
    getProductById,
    getAllProducts,
    createSupplier,
    getAllSuppliersWithProducts,
    getAllSuppliers,
    getSupplierProducts
};
