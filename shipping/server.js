// Imports
const amqp = require("amqplib");
const crypto = require("crypto");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    await createChannel("shipment_service", "local_exchange", "shipment_service");

    // Consume messages
    // Order management publishes here when an order is created, updated, or deleted.
    rabbitmqChannel.consume("shipment_service", async (message) => {
        const json = JSON.parse(message.content.toString());

        console.log(`[ShippingService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

        try {
            await handleMessage(json);
        } catch (error) {
            // Log but do not crash -- one bad message should never take down the whole service
            console.error(`[ShippingService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            // Always acknowledge the message so it is removed from the queue
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

// Carrier routes

// Get all carriers (useful for showing which options exist)
app.get("/carrier", async (req, res) => {
    try {
        const result = await dbService.getAllCarriers();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Shipment routes

// Get all shipments
app.get("/shipment", async (req, res) => {
    try {
        const result = await dbService.getAllShipments();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single shipment by id
app.get("/shipment/:id", async (req, res) => {
    try {
        const result = await dbService.getShipment(req.params.id);

        if (!result) {
            return res.status(404).json({ error: "Shipment not found" });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get shipment for  specific order
app.get("/shipment/order/:orderId", async (req, res) => {
    try {
        const result = await dbService.getShipmentByOrderId(req.params.orderId);

        if (!result) {
            return res.status(404).json({ error: "No shipment found for this order" });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manually mark shipment as shipped (for postman/bruno demo)
app.put("/shipment/:id/ship", async (req, res) => {
    try {
        console.log(`[ShippingService] Manually shipping shipment ${req.params.id}`);

        const shipment = await dbService.getShipment(req.params.id);

        if (!shipment) {
            return res.status(404).json({ error: "Shipment not found" });
        }

        const updated = await dbService.updateShipmentStatus(req.params.id, "Shipped");

        // Notify Order management order has been shipped
        await publishMessage(
            "local_exchange",
            "order_service",
            "shipment_dispatched",
            "update_status",
            { orderId: shipment.orderId, orderStatus: "Shipped" }
        );

        // Also notify Customer service so it updates local database
        await publishMessage(
            "local_exchange",
            "costumer_service",
            "shipment_dispatched",
            "update_status",
            { orderId: shipment.orderId, orderStatus: "Shipped" }
        );

        const date = new Date();
        await dbService.createEventLog({
            name: `Shipment dispatched at ${date}`,
            description: `Shipment ${req.params.id} for order ${shipment.orderId} manually marked as shipped at ${date}`,
            date: date
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Misc routes

// Get event log
app.get("/event", async (req, res) => {
    try {
        const result = await dbService.getEventLogs();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disable powered by header for security reasons
app.disable("x-powered-by");

// Start listening on port
app.listen(5004, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:5004`);
});


// Handle incoming messages from Order management
async function handleMessage(json) {
    const job = json.meta.job;

    // Order management says new order was placed -> create shipment for it
    if (job === "add_order") {
        const order = json.data.order;

        const { shipment, carrier } = await dbService.createShipment(order.orderId, order.customerId);

        // Tell Order management shipment is pending
        await publishMessage(
            "local_exchange",
            "order_service",
            "shipment_created",
            "update_status",
            { orderId: order.orderId, orderStatus: "Shipment pending" }
        );

        // Also tell Customer service so its local databaseis updated
        await publishMessage(
            "local_exchange",
            "costumer_service",
            "shipment_created",
            "update_status",
            { orderId: order.orderId, orderStatus: "Shipment pending" }
        );

        const date = new Date();
        await dbService.createEventLog({
            name: `Shipment created at ${date}`,
            description: `Created shipment for order ${order.orderId} using carrier ${carrier.name} (€${carrier.pricePerShipment}) at ${date}`,
            date: date
        });

        console.log(`[ShippingService] Shipment created for order ${order.orderId}`);
    }

    // Warehouse says the order is packaged and ready to ship -> dispatch the shipment
    if (job === "send_shipment") {
        const orderId = json.data.orderId;

        const shipment = await dbService.getShipmentByOrderId(orderId);

        if (!shipment) {
            console.error(`[ShippingService] No shipment found for order ${orderId} to dispatch`);
            return;
        }

        await dbService.updateShipmentStatus(shipment.shipmentId, "Shipped");

        // Tell Order management the order has been shipped
        await publishMessage(
            "local_exchange",
            "order_service",
            "shipment_dispatched",
            "update_status",
            { orderId: orderId, orderStatus: "Shipped" }
        );

        // Also tell Customer service so its local database is updated
        await publishMessage(
            "local_exchange",
            "costumer_service",
            "shipment_dispatched",
            "update_status",
            { orderId: orderId, orderStatus: "Shipped" }
        );

        const date = new Date();
        await dbService.createEventLog({
            name: `Shipment dispatched at ${date}`,
            description: `Dispatched shipment ${shipment.shipmentId} for order ${orderId} after warehouse packaging at ${date}`,
            date: date
        });

        console.log(`[ShippingService] Shipment for order ${orderId} dispatched (warehouse packaged)`);
    }

    // Order management says order was updated -> update matching shipment status
    if (job === "update_order") {
        const order = json.data.order || json.data.updatedOrder?.order || json.data.updatedOrder;

        if (!order || !order.orderId) {
            console.error(`[ShippingService] Could not find order data in update_order message. Payload: ${JSON.stringify(json.data)}`);
            return;
        }

        // We dont automatically change the shipment status on every order update,
        // "order updated" doesn't always mean the shipment changed.
        // Just log it so there's a record.
        const date = new Date();
        await dbService.createEventLog({
            name: `Order update received at ${date}`,
            description: `Received order_updated for order ${order.orderId} at ${date}`,
            date: date
        });

        console.log(`[ShippingService] Received order update for order ${order.orderId}`);
    }

    // Order management says order was deleted -> cancel shipment
    if (job === "delete_order") {
        const orderId = json.data.orderId;

        const shipment = await dbService.getShipmentByOrderId(orderId);

        if (shipment) {
            await dbService.updateShipmentStatus(shipment.shipmentId, "Cancelled");

            const date = new Date();
            await dbService.createEventLog({
                name: `Shipment cancelled at ${date}`,
                description: `Cancelled shipment ${shipment.shipmentId} because order ${orderId} was deleted at ${date}`,
                date: date
            });

            console.log(`[ShippingService] Cancelled shipment for deleted order ${orderId}`);
        }
    }
}

// Create a new RabbitMQ channel
async function createChannel(queueName, sourceName, pattern) {
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

    rabbitmqChannel = await connection.createChannel();
    console.log(`[BusManager] Channel created`);

    // Fair dispatch: handle one message at a time.
    await rabbitmqChannel.prefetch(1);

    await rabbitmqChannel.assertExchange(sourceName, "direct", { durable: true });
    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    console.log(`[BusManager] Queue asserted: ` + queueName);

    await rabbitmqChannel.bindQueue(queueName, sourceName, pattern);
    console.log(`[BusManager] Bound to routing key: ` + queueName);
}

// Publish a message to another service via RabbitMQ
async function publishMessage(exchange, receivingChannel, event, job, data) {
    rabbitmqChannel.publish(
        exchange,
        receivingChannel,
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