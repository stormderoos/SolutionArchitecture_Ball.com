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
    await createChannel("costumer_service", "local_exchange", "costumer_service");

    // Consume messages
    rabbitmqChannel.consume("costumer_service", async (message) => {
        const json = JSON.parse(message.content.toString());

        console.log(`[CustomerService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

        try {
            // Handle incoming messages
            await handleMessage(json);
        } catch (error) {
            // Log the error but do not crash the process or requeue forever (no poison-message loop)
            console.error(`[CustomerService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            // Always remove the message from the queue
            rabbitmqChannel.ack(message);
        }
    });

    // Import customers once on startup
    await importCustomersFromCsv();
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

//Ccustomer routes

// Create a customer
app.post("/customer/create", async (req, res) => {
    try {
        console.log("[CustomerService] Customer create: ", req.body);
        const result = await dbService.createCustomer(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all customers
app.get("/customer", async (req, res) => {
    try {
        const result = await dbService.getAllCustomers();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a customer
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

// Update a customer
app.put("/customer/update", async (req, res) => {
    try {
        console.log("[CustomerService] Customer update: ", req.body);
        const result = await dbService.updateCustomer(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a customer
app.delete("/customer/:id", async (req, res) => {
    try {
        console.log("[CustomerService] Customer delete: ", req.params.id);
        const result = await dbService.deleteCustomer(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//Track & support routes

// Get all orders tracked for a customer
app.get("/customer/:id/orders", async (req, res) => {
    try {
        const result = await dbService.getOrdersByCustomerId(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get the tracked status of one specific order
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

//Ticket routes

// Create a support ticket
app.post("/ticket/create", async (req, res) => {
    try {
        console.log("[CustomerService] Ticket create: ", req.body);
        const result = await dbService.createTicket(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all tickets
app.get("/ticket", async (req, res) => {
    try {
        const result = await dbService.getAllTickets();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get ingle ticket
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

// Get all tickets for customer
app.get("/customer/:id/tickets", async (req, res) => {
    try {
        const result = await dbService.getTicketsByCustomerId(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Answer a ticket (service department responds)
app.put("/ticket/:id/answer", async (req, res) => {
    try {
        console.log(`[CustomerService] Answering ticket ${req.params.id}: `, req.body);
        const result = await dbService.answerTicket(req.params.id, req.body.response);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Close a ticket
app.put("/ticket/:id/close", async (req, res) => {
    try {
        const result = await dbService.closeTicket(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// other routes

// Get the event log
app.get("/event", async (req, res) => {
    try {
        const result = await dbService.getEventLogs();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// manually trigger CSV import (for testing bruno/ostman)
app.post("/customer/import", async (req, res) => {
    try {
        const result = await importCustomersFromCsv();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// disable powered by header for security reasons
app.disable("x-powered-by");

// Start listening on port
app.listen(5003, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:` + 5003);
});

// Functions

// Handle incoming messages from other services
async function handleMessage(json) {
    const job = json.meta.job;

    // Order management published order_created -> add order to local tracking table
    if (job === "add_order") {
        const order = json.data.order;

        const result = await dbService.addOrder(order.customerId, order.orderId, order.orderStatus);

        if (result) {
            const date = new Date();
            await dbService.createEventLog({
                name: `Order added to customer at ${date}`,
                description: `Added order ${order.orderId} to customer ${order.customerId} at ${date}`,
                date: date
            });

            console.log(`[CustomerService] Added order ${order.orderId} to customer ${order.customerId}`);
        }
    }

    // Order management published order_updated -> update local copy
    if (job === "update_order") {
        const updatedOrder =
            json.data.order ||                  // correct one (remove the others soon)
            json.data.updatedOrder?.order ||     // from an older version
            json.data.updatedOrder;              // from an even older version

            if (!updatedOrder || !updatedOrder.orderId) {
            console.error(
                `[CustomerService] could not find order data in update_order message. ` +
                `Payload was: ${JSON.stringify(json.data)}`
            );
            return;
        }
    

        await dbService.updateOrderStatus(updatedOrder.orderId, updatedOrder.orderStatus);

        const date = new Date();
        await dbService.createEventLog({
            name: `Order status updated at ${date}`,
            description: `Updated order ${updatedOrder.orderId} status to ${updatedOrder.orderStatus} at ${date}`,
            date: date
        });

        console.log(`[CustomerService] Updated order ${updatedOrder.orderId} status to ${updatedOrder.orderStatus}`);
    }

    // Order management, Warehouse or Payment published a status update for an order
    // mirror the change in local tracking table
    if (job === "update_status") {
        const { orderId, orderStatus } = json.data;

        await dbService.updateOrderStatus(orderId, orderStatus);

        const date = new Date();
        await dbService.createEventLog({
            name: `Order status updated at ${date}`,
            description: `Updated order ${orderId} status to ${orderStatus} at ${date}`,
            date: date
        });

        console.log(`[CustomerService] Updated order ${orderId} status to ${orderStatus}`);
    }

    // Order management published order_deleted -> remove order from local tracking table
    if (job === "delete_order") {
        const orderId = json.data.orderId;

        await dbService.removeOrder(orderId);

        const date = new Date();
        await dbService.createEventLog({
            name: `Order removed at ${date}`,
            description: `Removed order ${orderId} from customer tracking at ${date}`,
            date: date
        });

        console.log(`[CustomerService] Removed order ${orderId} from tracking`);
    }
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

    rabbitmqChannel = await connection.createChannel();
    console.log(`[BusManager] Channel created`);

    await rabbitmqChannel.assertExchange(sourceName, "direct", { durable: true });

    await rabbitmqChannel.assertQueue(queueName, { durable: true });
    console.log(`[BusManager] Queue asserted: ` + queueName);

    await rabbitmqChannel.bindQueue(queueName, sourceName, pattern);
    console.log(`[BusManager] Bound to routing key: ` + queueName);
}

// Publishmessage to another channel
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

// Import customers from external CSV
async function importCustomersFromCsv() {
    console.log("[CustomerService] Starting CSV import...");

    const rows = await csvReader.readCustomerCsv();

    let importedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
        const { customer, imported } = await dbService.importCustomerFromCsv(row);

        if (imported) {
            importedCount++;

            // Publish CustomerImported domain event
            if (rabbitmqChannel) {
                await publishMessage(
                    "local_exchange",
                    "costumer_service",
                    "customer_imported",
                    "log_import",
                    { customer }
                );
            }
        } else {
            skippedCount++;
        }
    }

    const date = new Date();
    await dbService.createEventLog({
        name: `CSV import at ${date}`,
        description: `Imported ${importedCount} new customers, skipped ${skippedCount} existing customers`,
        date: date
    });

    console.log(`[CustomerService] CSV import complete: ${importedCount} imported, ${skippedCount} skipped`);

    return { importedCount, skippedCount, total: rows.length };
}