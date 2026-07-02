// Imports
const amqp = require("amqplib");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");
const excelReader = require("./excelReader");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    await createChannel("order_read_service", "local_exchange", "order_read_service");

    // Consume messages
    rabbitmqChannel.consume("order_read_service", async (message) => {
        const json = JSON.parse(message.content.toString());

        console.log(`[OrderReadService] [${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

        try {
            // Handel incomming messages
            await handelMessage(json);
        } catch (error) {
            // Log the error but do not crash the process or requeue forever (no poison-message loop)
            console.error(`[OrderReadService] Error handling message ${json.meta.uuid}:`, error);
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
// Get an order
app.get("/order/:id", async (req, res) => {
    try {
        console.log("[OrderService] Order get: ", req.params.id);
        const result = await getOrder(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all orders
app.get("/order", async (req, res) => {
    try {
        console.log("[OrderService] Order get all");
        const result = await dbService.getAllOrders();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get external data
app.get("/customerData", async (req, res) => {
    try {
        const customers = await excelReader.readExcelFile(0);
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: "Failed to read customer data" });
    }
});

// Disable powered by header for security reasons
app.disable("x-powered-by");

// Start listening on port
app.listen(5010, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:` + 5010);
});

// Functions
// Get a order
async function getOrder(orderId) {
    console.log(`[OrderService] Getting order ${orderId}`);

    // Get the order from the database
    const order = await dbService.getOrder(orderId);
    console.log(`Order: ${order}`);

    return order;
}

// Get all orders
async function getAllOrders() {
    console.log(`[OrderService] Getting all orders`);

    // Get the order from the database
    const orders = await dbService.getAllOrders();
    console.log(`Orders: ${orders}`);

    return orders;
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

    // Fair dispatch: handle one message at a time.
    await rabbitmqChannel.prefetch(1);

    // Assert the exchange
    await rabbitmqChannel.assertExchange(sourceName, "direct", { durable: true });


    // Assert the queue
    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    console.log(`[BusManager] Queue asserted: ` + queueName);

    // Bind the queue to the channel
    await rabbitmqChannel.bindQueue(queueName, sourceName, pattern);
    console.log(`[BusManager] Bound to routing key: ` + queueName);
}

// Publish a message to another channel
async function publishMessage(exchange, recivingChannel, event, job, data) {
    rabbitmqChannel.publish(
        exchange,
        recivingChannel,
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: event,
                    job: job
                },
                data: data
            })
        ),
        { persistent: true }
    );
}

// Handel incomming messages
// CQRS: the read side projects the order events (published by the write side) into
// its own read model. The queries above read from that projection.
async function handelMessage(json) {
    const job = json.meta.job;

    // Handel an OrderCreated event
    if (job === "handel_event") {
        console.log(`[OrderReadService] Recieved event: ${json.log.name}`);
        await dbService.handelEvent(json.log);
        console.log(`[OrderReadService] Event handeled`);
    }
}
