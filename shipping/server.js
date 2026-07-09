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
    // Pub/sub fixed
    const events = [
        "order_created",    // new order placed -> create shipment
        "order_updated",    // order changed -> log
        "order_deleted",    // order cancelled -> cancel shipment
        "package_created"   // warehouse finished packaging -> dispatch shipment
    ];

    await createChannel("shipping_service", "local_exchange", events);

    rabbitmqChannel.consume("shipping_service", async (message) => {
        const json = JSON.parse(message.content.toString());

        console.log(`[ShippingService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

        try {
            await handleMessage(json);
        } catch (error) {
            console.error(`[ShippingService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            rabbitmqChannel.ack(message);
        }
    });
};

run();

// Setup the Express app
const app = express();

app.enable("trust proxy");

app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
    console.log(`[Web]: ${req.originalUrl}`);
    next();
});

app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "*");
    next();
});

// Carrier routes

app.get("/carrier", async (req, res) => {
    try {
        const result = await dbService.getAllCarriers();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Shipment routes

app.get("/shipment", async (req, res) => {
    try {
        const result = await dbService.getAllShipments();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

// Manually mark shipment as shipped and publish shipment_dispatched event (fpr postman demo).
app.put("/shipment/:id/ship", async (req, res) => {
    try {
        console.log(`[ShippingService] Dispatching shipment ${req.params.id}`);

        const shipment = await dbService.getShipment(req.params.id);
        if (!shipment) {
            return res.status(404).json({ error: "Shipment not found" });
        }

        const updated = await dbService.updateShipmentStatus(req.params.id, "Shipped");

        // publish shipment_dispatched as event.
        // order management and customer service are subscribed to this event-(type)
        await publishMessage("local_exchange", "shipment_dispatched", {
            orderId: shipment.orderId,
            orderStatus: "Shipped"
        });

        const date = new Date();
        await dbService.createEventLog({
            name: `Shipment dispatched at ${date}`,
            description: `Shipment ${req.params.id} for order ${shipment.orderId} dispatched`,
            date: date
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Misc routes

app.get("/event", async (req, res) => {
    try {
        const result = await dbService.getEventLogs();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.disable("x-powered-by");

app.listen(5004, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:5004`);
});

// Functions

// Handle incoming messages from the exchange.
async function handleMessage(json) {
    const event = json.meta.event;

    // order_created: Order management placed new order ->
    // pick cheapest carrier and create shipment.
    // Publishes shipment_created (Order management and Customer service are subcsribed to this event)
    if (event === "order_created") {
        const order = json.data.order;

        if (!order || !order.orderId) {
            console.error(`[ShippingService] order_created missing order data: ${JSON.stringify(json.data)}`);
            return;
        }

        const { shipment, carrier } = await dbService.createShipment(order.orderId, order.customerId);

        await publishMessage("local_exchange", "shipment_created", {
            orderId: order.orderId,
            orderStatus: "Shipment pending"
        });

        const date = new Date();
        await dbService.createEventLog({
            name: `Shipment created at ${date}`,
            description: `Shipment for order ${order.orderId} using ${carrier.name} (€${carrier.pricePerShipment})`,
            date: date
        });
        console.log(`[ShippingService] Shipment created for order ${order.orderId} via ${carrier.name}`);
    }

    // package_created: Warehouse finished packaging order
    if (event === "package_created") {
        const orderId = json.data.orderId;

        const shipment = await dbService.getShipmentByOrderId(orderId);
        if (!shipment) {
            console.error(`[ShippingService] No shipment found for order ${orderId} to dispatch`);
            return;
        }

        await dbService.updateShipmentStatus(shipment.shipmentId, "Shipped");

        // Publish shipment_dispatched. Order management is subscribed and
        // will update order status to "Shipped".
        await publishMessage("local_exchange", "shipment_dispatched", {
            orderId: orderId,
            orderStatus: "Shipped"
        });

        const date = new Date();
        await dbService.createEventLog({
            name: `Shipment dispatched at ${date}`,
            description: `Shipment ${shipment.shipmentId} dispatched after warehouse packaged order ${orderId}`,
            date: date
        });
        console.log(`[ShippingService] Shipment for order ${orderId} dispatched`);
    }

    // order_updated: order details changed.
    if (event === "order_updated") {
        const order = json.data.order || json.data;

        if (!order || !order.orderId) {
            console.error(`[ShippingService] order_updated missing order data`);
            return;
        }

        const date = new Date();
        await dbService.createEventLog({
            name: `Order update received at ${date}`,
            description: `Received order_updated for order ${order.orderId}`,
            date: date
        });
        console.log(`[ShippingService] Received order update for order ${order.orderId}`);
    }

    // order_deleted: Order management deleted an order -> cancel shipment.
    if (event === "order_deleted") {
        const orderId = json.data.orderId;

        const shipment = await dbService.getShipmentByOrderId(orderId);
        if (shipment) {
            await dbService.updateShipmentStatus(shipment.shipmentId, "Cancelled");

            const date = new Date();
            await dbService.createEventLog({
                name: `Shipment cancelled at ${date}`,
                description: `Cancelled shipment ${shipment.shipmentId} because order ${orderId} was deleted`,
                date: date
            });
            console.log(`[ShippingService] Cancelled shipment for deleted order ${orderId}`);
        }
    }
}

// Create RabbitMQ chanel and subscribe to given event names.
// Each event name is a routing key for to the queue on the exchange.
async function createChannel(queueName, exchangeName, events) {
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

    await rabbitmqChannel.prefetch(1);

    await rabbitmqChannel.assertExchange(exchangeName, "direct", { durable: true });

    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    console.log(`[BusManager] Queue asserted: ${queueName}`);

    for (const event of events) {
        await rabbitmqChannel.bindQueue(queueName, exchangeName, event);
        console.log(`[BusManager] Subscribed to ${event}`);
    }
}

// Publish a event to exchange.
async function publishMessage(exchange, event, data) {
    rabbitmqChannel.publish(
        exchange,
        event,
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: event
                },
                data: data
            })
        ),
        { persistent: true }
    );
}