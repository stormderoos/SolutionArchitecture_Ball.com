const amqp = require("amqplib");
const crypto = require("crypto");
const express = require("express");
const dbService = require("./dbService");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";

const exchangeName = "local_exchange";
const queueName = "catalog_service";
const routingKey = "catalog_service";
let rabbitmqChannel = null;

async function createChannel() {
    const connection = await amqp.connect(rabbitmqUrl);
    rabbitmqChannel = await connection.createChannel();
    await rabbitmqChannel.assertExchange(exchangeName, "direct", { durable: true });
    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    await rabbitmqChannel.bindQueue(queueName, exchangeName, routingKey);

    rabbitmqChannel.consume(queueName, async (message) => {
        if (!message) {
            return;
        }

        try {
            const json = JSON.parse(message.content.toString());
            console.log(`[CatalogService] Received message: ${JSON.stringify(json)}`);
        } catch (err) {
            console.error("[CatalogService] Invalid message received", err);
        }

        rabbitmqChannel.ack(message);
    });

    console.log("[CatalogService] RabbitMQ channel created and queue bound");
}

async function publishEvent(event, job, data) {
    if (!rabbitmqChannel) {
        return;
    }

    const payload = {
        meta: {
            uuid: crypto.randomUUID(),
            event,
            job
        },
        data
    };

    rabbitmqChannel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(payload)), {
        persistent: false
    });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "*");
    next();
});

app.get("/", (req, res) => {
    res.json({ service: "catalog", status: "ok" });
});

app.get("/products", async (req, res) => {
    try {
        const products = await dbService.getAllProducts();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/suppliers", async (req, res) => {
    try {
        const suppliers = await dbService.getAllSuppliersWithProducts();
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/products", async (req, res) => {
    try {
        const product = await dbService.createProduct(req.body);
        await publishEvent("product_created", "new_product", product);
        res.status(201).json(product);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post("/suppliers", async (req, res) => {
    try {
        const supplier = await dbService.createSupplier(req.body);
        await publishEvent("supplier_created", "new_supplier", supplier);
        res.status(201).json(supplier);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put("/products/:id", async (req, res) => {
    try {
        const updatedProduct = await dbService.updateProduct(req.params.id, req.body);
        await publishEvent("product_updated", "update_product", updatedProduct);
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put("/suppliers/:id", async (req, res) => {
    try {
        const updatedSupplier = await dbService.updateSupplier(req.params.id, req.body);
        await publishEvent("supplier_updated", "update_supplier", updatedSupplier);
        res.json(updatedSupplier);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.disable("x-powered-by");

const port = process.env.PORT || 5000;
app.listen(port, "0.0.0.0", async () => {
    try {
        await createChannel();
    } catch (err) {
        console.error("[CatalogService] RabbitMQ connection failed", err.message);
    }

    console.log(`[CatalogService] Running on http://0.0.0.0:${port}`);
});
