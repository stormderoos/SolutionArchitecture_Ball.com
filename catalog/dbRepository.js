const products = [];
const suppliers = [];
const supplierProducts = [];
let nextProductId = 1;
let nextSupplierId = 1;

const mysql = require("mysql2/promise");
let pool = null;

async function ensureDatabaseAndTables() {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
        return;
    }

    const adminPool = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        waitForConnections: true
    });

    await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
    await adminPool.end();

    pool = require("./db");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS Supplier (
            supplierId INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS Product (
            productId INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255),
            price DECIMAL(10,2) DEFAULT 0,
            weight DECIMAL(10,2) DEFAULT 0,
            description TEXT,
            manufacturer VARCHAR(255),
            amountStored INT DEFAULT 0
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS SupplierProducts (
            supplierId INT,
            productId INT,
            PRIMARY KEY (supplierId, productId)
        )
    `);

    const [supRows] = await pool.query("SELECT COUNT(*) as c FROM Supplier");
    if (supRows[0].c === 0) {
        const [r1] = await pool.query("INSERT INTO Supplier (name) VALUES (?)", ["Ball Supply Co."]);
        const ballSupplyId = r1.insertId;
        const [r2] = await pool.query("INSERT INTO Supplier (name) VALUES (?)", ["Sporting Goods BV"]);
        const sportingGoodsId = r2.insertId;
        const [r3] = await pool.query("INSERT INTO Supplier (name) VALUES (?)", ["Hydration Partners"]);
        const hydrationPartnersId = r3.insertId;

        const [p1] = await pool.query("INSERT INTO Product (name, price, weight, description, manufacturer, amountStored) VALUES (?, ?, ?, ?, ?, ?)", ["Ball", 9.99, 0.25, "Standard ball", "Ball Co", 100]);
        const [p2] = await pool.query("INSERT INTO Product (name, price, weight, description, manufacturer, amountStored) VALUES (?, ?, ?, ?, ?, ?)", ["Football", 12.99, 0.45, "Outdoor football", "Ball Co", 50]);
        const [p3] = await pool.query("INSERT INTO Product (name, price, weight, description, manufacturer, amountStored) VALUES (?, ?, ?, ?, ?, ?)", ["Water bottle", 4.75, 0.30, "Plastic water bottle", "Hydration Partners", 200]);

        await pool.query("INSERT INTO SupplierProducts (supplierId, productId) VALUES (?, ?)", [ballSupplyId, p1.insertId]);
        await pool.query("INSERT INTO SupplierProducts (supplierId, productId) VALUES (?, ?)", [ballSupplyId, p2.insertId]);
        await pool.query("INSERT INTO SupplierProducts (supplierId, productId) VALUES (?, ?)", [hydrationPartnersId, p3.insertId]);
    }

    const [suppliersRows] = await pool.query("SELECT * FROM Supplier");
    suppliers.length = 0;
    for (const s of suppliersRows) {
        suppliers.push({ supplierId: s.supplierId, name: s.name });
        nextSupplierId = Math.max(nextSupplierId, s.supplierId + 1);
    }

    const [productRows] = await pool.query("SELECT * FROM Product");
    products.length = 0;
    for (const p of productRows) {
        products.push({ productId: p.productId, name: p.name, price: Number(p.price), weight: Number(p.weight), description: p.description, manufacturer: p.manufacturer, amountStored: Number(p.amountStored) });
        nextProductId = Math.max(nextProductId, p.productId + 1);
    }

    const [links] = await pool.query("SELECT * FROM SupplierProducts");
    supplierProducts.length = 0;
    for (const l of links) {
        supplierProducts.push({ supplierId: l.supplierId, productId: l.productId });
    }
}

ensureDatabaseAndTables().catch((err) => console.error("[Catalog DB] initialization failed", err));

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
        weight: Number(product.weight) || 0,
        description: product.description ?? null,
        manufacturer: product.manufacturer ?? null,
        amountStored: Number(product.amountStored) || 0
    };

    products.push(newProduct);
    supplierProducts.push({ supplierId: Number(supplierId), productId: newProduct.productId });

    if (pool) {
        (async () => {
            try {
                const [res] = await pool.query("INSERT INTO Product (name, price, weight, description, manufacturer, amountStored) VALUES (?, ?, ?, ?, ?, ?)", [newProduct.name, newProduct.price, newProduct.weight, newProduct.description, newProduct.manufacturer, newProduct.amountStored]);
                const dbId = res.insertId;
                // update in-memory id and supplierProducts link
                const idx = products.findIndex((p) => p === newProduct);
                if (idx !== -1) products[idx].productId = dbId;
                for (const link of supplierProducts) {
                    if (link.productId === newProduct.productId) link.productId = dbId;
                }
                await pool.query("INSERT INTO SupplierProducts (supplierId, productId) VALUES (?, ?)", [Number(supplierId), dbId]);
            } catch (err) {
                console.error("[Catalog DB] createProduct persist failed", err.message);
            }
        })();
    }

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
    if (updates.description !== undefined) existingProduct.description = updates.description;
    if (updates.manufacturer !== undefined) existingProduct.manufacturer = updates.manufacturer;
    if (updates.amountStored !== undefined) existingProduct.amountStored = Number(updates.amountStored) || 0;

    if (pool) {
        (async () => {
            try {
                await pool.query("UPDATE Product SET name = ?, price = ?, weight = ?, description = ?, manufacturer = ?, amountStored = ? WHERE productId = ?", [existingProduct.name, existingProduct.price, existingProduct.weight, existingProduct.description, existingProduct.manufacturer, existingProduct.amountStored, existingProduct.productId]);
            } catch (err) {
                console.error("[Catalog DB] updateProduct failed", err.message);
            }
        })();
    }

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

    if (pool) {
        (async () => {
            try {
                const [res] = await pool.query("INSERT INTO Supplier (name) VALUES (?)", [newSupplier.name]);
                const dbId = res.insertId;
                const idx = suppliers.findIndex((s) => s === newSupplier);
                if (idx !== -1) suppliers[idx].supplierId = dbId;
                for (const productId of productIds) {
                    await pool.query("INSERT INTO SupplierProducts (supplierId, productId) VALUES (?, ?)", [dbId, Number(productId)]);
                }
            } catch (err) {
                console.error("[Catalog DB] createSupplier persist failed", err.message);
            }
        })();
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
    createProduct({ name: "Football", price: 12.99, weight: 0.45, description: "Outdoor football", manufacturer: "Ball Co", amountStored: 50 }, ballSupply.supplierId);
    createProduct({ name: "Water bottle", price: 4.75, weight: 0.30, description: "Plastic water bottle", manufacturer: "Hydration Partners", amountStored: 200 }, hydrationPartners.supplierId);
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
