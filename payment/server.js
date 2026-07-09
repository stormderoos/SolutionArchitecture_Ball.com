// Imports
const amqp = require("amqplib");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    // Pub/sub: this service SUBSCRIBES to order events by their name. It does
    // not know who publishes them; it only reacts to what happened.
    const events = [
        "order_created", // a new order was placed -> process its payment
        "order_deleted"  // the order was removed  -> delete its payment
    ];

    await createChannel("payment_service", "local_exchange", events);

    // Consume messages
    rabbitmqChannel.consume("payment_service", async (message) => {
        const json = JSON.parse(message.content.toString());
        console.log(
            `[PaymentService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`
        );

        try {
            // Handle incoming events (dispatch on the event NAME, not the sender)
            await handleMessage(json);
        } catch (error) {
            // Log the error but do not crash the process or requeue forever (no poison-message loop)
            console.error(`[PaymentService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            // Always remove the message from the queue
            rabbitmqChannel.ack(message);
        }
    });
};

// Handle incoming events (pub/sub). We route on json.meta.event -- the name of
// the thing that happened -- so the sender and receiver only share an event
// contract, not knowledge of each other.
async function handleMessage(json) {
    const event = json.meta.event;

    if (event === "order_created") {
        // Start (and settle) the payment for the newly created order
        await startPayment(json.data, json.data.products || []);
    } else if (event === "order_deleted") {
        // Remove the payment that belonged to the deleted order
        await deletePayment(json.data.orderId);
    }
}

run();

// Setup the Express app
const app = express();
app.enable("trust proxy");
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
// Get all payments
app.get("/payments", async (req, res) => {
    try {
        res.json(await dbService.getPayments());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a payment by order id
app.get("/payment/:orderId", async (req, res) => {
    try {
        res.json(await dbService.getPaymentByOrderId(req.params.orderId));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manually process a payment (handy for testing via Postman)
app.post("/payment/process", async (req, res) => {
    try {
        const payment = await startPayment(req.body.order, req.body.products);
        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.disable("x-powered-by");

// Start listening on port
app.listen(5001, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:` + 5001);
});

// Functions
// Start a payment for an order
const startPayment = async (order, products) => {
    console.log(`[PaymentService] Processing payment for order ${order.orderId}...`);

    // Create and process the payment in the database
    const payment = await dbService.processPayment(order, products);

    // Pub/sub: announce that the payment completed. We publish the EVENT, with
    // the routing key = event name, without naming any receiver. Whoever cares
    // (the order service) is subscribed to "payment_completed".
    await publishMessage("local_exchange", "payment_completed", {
        orderId: order.orderId,
        orderStatus: "Paid"
    });

    console.log(`[PaymentService] Payment ${payment.paymentId} completed and event published`);
    return payment;
};

// Delete a payment for an order
const deletePayment = async (orderId) => {
    console.log(`[PaymentService] Deleting payment for order ${orderId}`);
    await dbService.deletePayment(orderId);
};

// Create a new channel
async function createChannel(queueName, exchangeName, events) {
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
    await rabbitmqChannel.assertExchange(exchangeName, "direct", { durable: true });

    // Assert the queue
    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    console.log(`[BusManager] Queue asserted: ` + queueName);

    // Pub/sub: subscribe by binding our queue to every event we care about.
    // The routing key is the EVENT NAME, so we receive an event no matter who
    // published it.
    for (const event of events) {
        await rabbitmqChannel.bindQueue(queueName, exchangeName, event);
        console.log(`[BusManager] Subscribed to ${event}`);
    }
}

// Publish an event to the exchange (pub/sub). The routing key IS the event
// name, so the message reaches every queue that subscribed to that event --
// the publisher never names a receiver.
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
