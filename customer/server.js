// Imports
const amqp = require("amqplib");
const crypto = require("crypto");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");
const csvReader = require("./csvReader");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    // Pub/sub fixed

    const events = [
        "order_created",        // new order placed -> add to CustomerOrder read 
        "order_updated",        // order changed -> update local copy
        "order_status_updated", // status change (Picking, Paid, Shipped etc.)
        "order_deleted"         // order removed -> delete from local copy
    ];

    await createChannel("customer_service", "local_exchange", events);

    // Consume messages
    rabbitmqChannel.consume("customer_service", async (message) => {
        const json = JSON.parse(message.content.toString());

        console.log(`[CustomerService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

        try {
            await handleMessage(json);
        } catch (error) {
            console.error(`[CustomerService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            rabbitmqChannel.ack(message);
        }
    });

    // Import customers from CSV once on startup (ad hoc / EIP: File Transfer)
    await importCustomersFromCsv();
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

// Customer routes

app.post("/customer/create", async (req, res) => {
    try {
        console.log("[CustomerService] Customer create: ", req.body);
        const result = await dbService.createCustomer(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/customer", async (req, res) => {
    try {
        const result = await dbService.getAllCustomers();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/customer/:id", async (req, res) => {
    try {
        const result = await dbService.getCustomer(req.params.id);
        if (!result) {
            return res.status(404).json({ error: "Customer not found" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/customer/update", async (req, res) => {
    try {
        console.log("[CustomerService] Customer update: ", req.body);
        const result = await dbService.updateCustomer(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/customer/:id", async (req, res) => {
    try {
        console.log("[CustomerService] Customer delete: ", req.params.id);
        const result = await dbService.deleteCustomer(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Track & support routes

app.get("/customer/:id/orders", async (req, res) => {
    try {
        const result = await dbService.getOrdersByCustomerId(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/order/:orderId/status", async (req, res) => {
    try {
        const result = await dbService.getOrderStatus(req.params.orderId);
        if (!result) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ticket routes

app.post("/ticket/create", async (req, res) => {
    try {
        console.log("[CustomerService] Ticket create: ", req.body);
        const result = await dbService.createTicket(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get("/ticket", async (req, res) => {
    try {
        const result = await dbService.getAllTickets();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/ticket/:id", async (req, res) => {
    try {
        const result = await dbService.getTicket(req.params.id);
        if (!result) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/customer/:id/tickets", async (req, res) => {
    try {
        const result = await dbService.getTicketsByCustomerId(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/ticket/:id/answer", async (req, res) => {
    try {
        console.log(`[CustomerService] Answering ticket ${req.params.id}: `, req.body);
        const result = await dbService.answerTicket(req.params.id, req.body.response);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put("/ticket/:id/close", async (req, res) => {
    try {
        const result = await dbService.closeTicket(req.params.id);
        res.json(result);
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

app.post("/customer/import", async (req, res) => {
    try {
        const result = await importCustomersFromCsv();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.disable("x-powered-by");

app.listen(5003, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:5003`);
});

// Functions

// Handle incoming messages from the exchange.
async function handleMessage(json) {
    const event = json.meta.event;

    // order_created: Order management placed a new order ->
    // add it to local CustomerOrder read model (CQRS query side).
    if (event === "order_created") {
        const order = json.data.order || json.data;
        const orderId = order?.orderId || json.data.orderId;
        const customerId = order?.customerId || json.data.customerId;
        const orderStatus = order?.orderStatus || json.data.orderStatus;

        if (!orderId) {
            console.error(`[CustomerService] order_created missing order data: ${JSON.stringify(json.data)}`);
            return;
        }

        const result = await dbService.addOrder(customerId, orderId, orderStatus);

        if (result) {
            const date = new Date();
            await dbService.createEventLog({
                name: `Order added at ${date}`,
                description: `Added order ${orderId} for customer ${customerId}`,
                date: date
            });
            console.log(`[CustomerService] Added order ${orderId} for customer ${customerId}`);
        }
    }

    // order_updated: Order management updated order ->
    // update local copy to stay synched.
    if (event === "order_updated") {
        const order = json.data.order || json.data;
        const orderId = order?.orderId || json.data.orderId;
        const orderStatus = order?.orderStatus || json.data.orderStatus;

        if (!orderId) {
            console.error(`[CustomerService] order_updated missing order data: ${JSON.stringify(json.data)}`);
            return;
        }

        await dbService.updateOrderStatus(orderId, orderStatus);

        const date = new Date();
        await dbService.createEventLog({
            name: `Order updated at ${date}`,
            description: `Updated order ${orderId} status to ${orderStatus}`,
            date: date
        });
        console.log(`[CustomerService] Updated order ${orderId} to ${orderStatus}`);
    }

    // order_status_updated: Warehouse, Payment, or Shipping reported a status change ->
    // mirror it in CustomerOrder read model (eventual consistency).
    if (event === "order_status_updated") {
        const { orderId, orderStatus } = json.data;

        await dbService.updateOrderStatus(orderId, orderStatus);

        const date = new Date();
        await dbService.createEventLog({
            name: `Order status updated at ${date}`,
            description: `Order ${orderId} status changed to ${orderStatus}`,
            date: date
        });
        console.log(`[CustomerService] Order ${orderId} status -> ${orderStatus}`);
    }

    // order_deleted: Order management deleted an order ->
    // remove it from CustomerOrder read model
    if (event === "order_deleted") {
        const orderId = json.data.orderId;

        await dbService.removeOrder(orderId);

        const date = new Date();
        await dbService.createEventLog({
            name: `Order removed at ${date}`,
            description: `Removed order ${orderId} from customer tracking`,
            date: date
        });
        console.log(`[CustomerService] Removed order ${orderId} from tracking`);
    }
}

// Create a new RabbitMQ channel and subscribe to the given list of event names.
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

    // Bind to every event this service cares about.
    for (const event of events) {
        await rabbitmqChannel.bindQueue(queueName, exchangeName, event);
        console.log(`[BusManager] Subscribed to ${event}`);
    }
}

// Publish a domain event to the exchange.
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

// The external customer system provides data as a CSV file
// it's read on startup and imports new customers
// created a customer_imported event for each one.
async function importCustomersFromCsv() {
    console.log("[CustomerService] Starting CSV import...");

    const rows = await csvReader.readCustomerCsv();

    let importedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
        const { customer, imported } = await dbService.importCustomerFromCsv(row);

        if (imported) {
            importedCount++;

            // Publish customer_imported as an event so any other service that cares about new
            // customers can subscribe to it
            if (rabbitmqChannel) {
                await publishMessage("local_exchange", "customer_imported", { customer });
            }
        } else {
            skippedCount++;
        }
    }

    const date = new Date();
    await dbService.createEventLog({
        name: `CSV import at ${date}`,
        description: `Imported ${importedCount} new customers, skipped ${skippedCount} existing`,
        date: date
    });

    console.log(`[CustomerService] CSV import complete: ${importedCount} imported, ${skippedCount} skipped`);

    return { importedCount, skippedCount, total: rows.length };
}
