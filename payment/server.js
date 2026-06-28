// Imports
const amqp = require("amqplib");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    await createChannel("payment_service", "local_exchange", "payment_service");

    // Consume messages
    rabbitmqChannel.consume("payment_service", async (message) => {
        const json = JSON.parse(message.content.toString());
        console.log(
            `[PaymentService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`
        );

        try {
            // Handle incoming jobs (sent by the order service)
            if (json.meta.job === "start_payment") {
                await startPayment(json.data.order, json.data.products);
            }

            if (json.meta.job === "delete_order") {
                await deletePayment(json.data.orderId);
            }
        } catch (error) {
            // Log the error but do not crash the process or requeue forever (no poison-message loop)
            console.error(`[PaymentService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            // Always remove the message from the queue
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

    // Publish event back to the order service so the order status is updated
    await publishMessage(
        "local_exchange",
        "order_service",
        "payment_completed",
        "update_status",
        {
            orderId: order.orderId,
            orderStatus: "Paid"
        }
    );

    console.log(`[PaymentService] Payment ${payment.paymentId} completed and event published`);
    return payment;
};

// Delete a payment for an order
const deletePayment = async (orderId) => {
    console.log(`[PaymentService] Deleting payment for order ${orderId}`);
    await dbService.deletePayment(orderId);
};

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
