// Imports
const amqp = require("amqplib");
const express = require("express");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    await createChannel("warehouse_service", "local_exchange", "warehouse_service");

    // Consume messages
    rabbitmqChannel.consume("warehouse_service", async (message) => {
        const json = JSON.parse(message.content.toString());
        console.log(
            `[WarehouseService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`
        );

        try {
            // Handle order creation
            if (json.meta.job === "move_product") {
                await moveProduct(json.data.order.orderId, json.data.products);
            }

            // Handle order update
            if (json.meta.job === "update_pick_list") {
                await dbService.updatePickList(json.data.order.orderId, json.data.orderProducts);
            }
        } catch (error) {
            // Log the error but do not crash the process or requeue forever (no poison-message loop)
            console.error(`[WarehouseService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            // Always remove the message from the queue
            rabbitmqChannel.ack(message);
        }
    });
};

run();

// Setup the Express app
const app = express();

// Trust proxy
app.enable("trust proxy");

// Enable body parsers
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: false }));

// Request logger
app.use((req, res, next) => {
    console.log(`[Web]: ${req.originalUrl}`);
    next();
});

// Allow CORS
app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "*");
    next();
});

// Api routes
// Create an pakkage
app.post("/package", async (req, res) => {
    try {
        console.log("[WarehouseService] Package create: ", req.body);
        const result = await createPackage(req.body.orderId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disable powered by header for security reasons
app.disable("x-powered-by");

// Start listening on port
app.listen(5100, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:` + 5100);
});

// Setup the Express app
const app = express();

// Trust proxy
app.enable("trust proxy");

// Enable body parsers
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: false }));

// Request logger
app.use((req, res, next) => {
    console.log(`[Web]: ${req.originalUrl}`);
    next();
});

// Allow CORS
app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "*");
    next();
});

// Api routes
// Create an pakkage
app.post("/package", async (req, res) => {
    try {
        console.log("[WarehouseService] Package create: ", req.body);
        const result = await createPackage(req.body.orderId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disable powered by header for security reasons
app.disable("x-powered-by");

// Start listening on port
app.listen(5100, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:` + 5100);
});

// Functions
// Move products
const moveProduct = async (orderId, productsToPick) => {
    // Handle product movement
    console.log(`[WarehouseService] Moving product...`);

    //Create a pick list to move the products to pick
    await dbService.createPickList(orderId, productsToPick);

    // Publish event to the order service
    rabbitmqChannel.publish(
        "local_exchange",
        "order_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "products_moved",
                    job: "update_status"
                },
                data: {
                    orderId: orderId,
                    orderStatus: "Picking products"
                }
            })
        ),
        { persistent: true }
    );

    console.log(`[WarehouseService] Products moved and event published`);
}

// Create package
const createPackage = async (orderId) => {
    // Handle product movement
    console.log(`[WarehouseService] Creating package...`);

    //Create a package ready for shipment
    const package = await dbService.createPackage(orderId);

    // Publish event to the order service
    rabbitmqChannel.publish(
        "local_exchange",
        "order_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "package_created",
                    job: "update_status"
                },
                data: {
                    orderId: orderId,
                    orderStatus: "Products picked"
                }
            })
        ),
        { persistent: true }
    );

    // Publish event to the shipment service
    rabbitmqChannel.publish(
        "local_exchange",
        "shipment_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "package_created",
                    job: "send_shipment"
                },
                data: {
                    orderId: orderId,
                    orderStatus: "Products picked"
                }
            })
        ),
        { persistent: true }
    );

    console.log(`[WarehouseService] Package created and event published`);

    return package;
}

// Create a new channel
async function createChannel(queueName, sourceName, pattern) {
    // Connect to rabbitMQ (retry until available, so we don't crash on a slow broker startup)
    let connection;
    for (let attempt = 1; ; attempt++) {
        try {
            connection = await amqp.connect(rabbitmqUrl);
            break;
        } catch (err) {
            console.log(`[BusManager] RabbitMQ not ready (attempt ${attempt}), retrying in 3s...`);
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
    console.log(`[BusManager] Connected to RabbitMQ`);

    // Create a channel
    rabbitmqChannel = await connection.createChannel();
    console.log(`[BusManager] Channel created`);

    // Assert the exchange
    await rabbitmqChannel.assertExchange(sourceName, "direct", { durable: true });


    // Assert the queue
    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    console.log(`[BusManager] Queue asserted: ` + queueName);

    // Bind the queue to the channel
    await rabbitmqChannel.bindQueue(queueName, sourceName, pattern);
    console.log(`[BusManager] Bound to routing key: ` + queueName);
}
