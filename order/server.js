// Imports
const amqp = require("amqplib");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    await createChannel("order_service", "local_exchange", "order_service");

    // Consume messages
    rabbitmqChannel.consume("order_service", async (message) => {
        try {
            const json = JSON.parse(message.content.toString());

            console.log(`[OrderService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

            // Handel incomming messages
            await handelMessage(json);
        } catch (err) {
            // Log the error but don't crash: a failing message must not stop the consumer
            console.error(`[OrderService] Error handling message:`, err);
        } finally {
            // Always remove the message from the queue so it doesn't loop forever
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

// Fill the read database
app.post("/event", async (req, res) => {
    try {
        console.log("[OrderService] Send all events to fill a database");
        const result = await sendAllEvents();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Api routes
// Create an order
app.post("/order", async (req, res) => {
    try {
        console.log("[OrderService] Order create: ", req.body);
        const result = await createOrder(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update an order
app.put("/order", async (req, res) => {
    try {
        console.log("[OrderService] Order update: ", req.body);
        const result = await updateOrder(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete an order
app.delete("/order/:id", async (req, res) => {
    try {
        console.log("[OrderService] Order delete: ", req.params.id);
        const result = await deleteOrder(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disable powered by header for security reasons
app.disable("x-powered-by");

// Start listening on port
app.listen(5000, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:` + 5000);
});

// Functions
// Create a order
const createOrder = async (request) => {
    // Handle order creation
    console.log(`[OrderService] Creating order...`);

    // Add order to database
    const createdOrder = await dbService.createOrder(request.order, request.products)

    // Add the event to history
    const date = new Date()
    const log = await dbService.createEventLog({
        type: "Create",
        name: `Create order at ${date}`,
        description: `Create a new order with order id ${request.order.orderId} at ${date}`,
        date: date,
        data: request.order
    })

    // Set the data to send
    const dataToSend = {
        order: request.order,
        products: request.products
    }

    // Publish event to the order read service
    await publishMessage("local_exchange", "order_read_service", "order_created", "handel_event", dataToSend, log);

    // Publish event to the warehouse service
    await publishMessage("local_exchange", "warehouse_service", "order_created", "move_product", dataToSend, log);

    // Publish event to the payment service
    await publishMessage("local_exchange", "payment_service", "order_created", "start_payment", dataToSend, log);

    // Publish event to the costumer service
    await publishMessage("local_exchange", "costumer_service", "order_created", "add_order", dataToSend, log);

    // Publish event to the shipment service
    await publishMessage("local_exchange", "shipment_service", "order_created", "add_order", dataToSend, log);

    console.log(`[OrderService] Order with id ${dataToSend.order.orderId} created and event published`);

    return dataToSend;
}

// Update a order
const updateOrder = async (request) => {
    // Handle order update
    console.log(`[OrderService] Updateing order ${request.order.orderId}`);

    // Add the event to history
    const date = new Date()
    const log = await dbService.createEventLog({
        type: "Update",
        name: `Update order at ${date}`,
        description: `Update the order with order id ${request.order} at ${date}`,
        date: date,
        data: request.order
    })

    // Update order in database
    const updatedOrder = await dbService.updateOrder(request.order, request.products)

    // Set the data to send
    const dataToSend = {
        order: request.order,
        products: request.products
    }

    // Publish event to the order read service
    await publishMessage("local_exchange", "order_read_service", "order_updated", "handel_event", dataToSend, log);

    // Publish event to the warehouse service
    await publishMessage("local_exchange", "warehouse_service", "order_updated", "update_pick_list", dataToSend, log);

    // Publish event to the payment service
    await publishMessage("local_exchange", "payment_service", "order_updated", "update_order", dataToSend, log);

    // Publish event to the costumer service
    await publishMessage("local_exchange", "costumer_service", "order_updated", "update_order", dataToSend, log);

    // Publish event to the shipment service
    await publishMessage("local_exchange", "shipment_service", "order_updated", "update_order", dataToSend, log);

    console.log(`[OrderService] Order updated and event published`);

    return dataToSend;
}

// Delete a order
const deleteOrder = async (orderId) => {
    // Delte the order from the database
    deletedOrder = await dbService.deleteOrder(orderId);

    // Set the data to send
    const dataToSend = {
        orderId: orderId
    }

    // Add the event to history
    const date = new Date()
    const log = await dbService.createEventLog({
        type: "Delete",
        name: `Delete order at ${date}`,
        description: `Delete the order with order id ${dataToSend} at ${date}`,
        date: date,
        data: dataToSend
    })

    // Publish event to the order read service
    await publishMessage("local_exchange", "order_read_service", "order_deleted", "handel_event", dataToSend, log);

    // Publish event to the payment service
    await publishMessage("local_exchange", "payment_service", "order_deleted", "delete_order", dataToSend, log);

    // Publish event to the costumer service
    await publishMessage("local_exchange", "costumer_service", "order_deleted", "delete_order", dataToSend, log);

    // Publish event to the shipment service
    await publishMessage("local_exchange", "shipment_service", "order_deleted", "delete_order", dataToSend, log);

    console.log(`[OrderService] Order deleted and event published`);
}

// Fill the read database
async function sendAllEvents() {
    const events = await dbService.getAllEvents();
    const dataToSend = {};

    for (const e of events) {
        // Publish event to the order read service
        await publishMessage("local_exchange", "order_read_service", "order_created", "handel_event", dataToSend, e);
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

    // Create a channel
    rabbitmqChannel = await connection.createChannel();
    console.log(`[BusManager] Channel created`);

    // Fair dispatch: handle one message at a time. This serialises the status
    // read-modify-write so concurrent status events can't cause a lost update.
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
async function publishMessage(exchange, recivingChannel, event, job, data, log) {
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
                data: data,
                log: log
            })
        ),
        { persistent: true }
    );
}

// Handel incomming messages
async function handelMessage(json) {
    // Read the job type from the message meta (this line was missing -> ReferenceError: job is not defined)
    const job = json.meta.job;

    // Handle update product (product replica from the Catalog upstream)
    if (job === "update_product") {
        // Upsert so the local replica stays in sync even if the create was missed
        let product = await dbService.upsertProduct(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            type: "Update",
            name: `Update product at ${date}`,
            description: `Update the product with id ${json.data.productId} at ${date}`,
            date: date,
            data: json.data
        })

        console.log(`Updated product: ${product}`)
    }

    // Handle update costumer
    if (job === "update_costumer") {
        // Update the costumer
        let costumer = await dbService.updateCostumer(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            type: "Update",
            name: `Update costumer at ${date}`,
            description: `Update the costumer with id ${json.data.costumerId} at ${date}`,
            date: date,
            data: json.data
        })

        console.log(`Updated costumer: ${json.data}`)
    }

    // Handle add product (product replica from the Catalog upstream)
    if (job === "add_product") {
        // Upsert on the Catalog productId so the local copy keeps the same identity
        const product = await dbService.upsertProduct(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            type: "Create",
            name: `Create product at ${date}`,
            description: `Create the product with id ${json.data.productId} at ${date}`,
            date: date,
            data: json.data
        })

        console.log(`[OrderService] Created product with id: ${json.data.productId}`)
    }

    // Handle add costumer
    if (job === "add_costumer") {
        // Create a costumer
        // const costumer = await dbService.createCostumer(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            type: "Create",
            name: `Create costumer at ${date}`,
            description: `Create the costumer with id ${json.data.costumerId} at ${date}`,
            date: date,
            data: json.data
        })

        console.log(`[OrderService] Created costumer with id: ${json.data.costumerId}`)
    }

    // Handle costumer deletion
    if (job === "delete_costumer") {
        //Delete a costumer
        const deletedCostumer = await dbService.deleteCostumer(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            type: "Delete",
            name: `Delete costumer at ${date}`,
            description: `Delete the costumer with id ${json.data} at ${date}`,
            date: date,
            data: json.data
        })

        console.log(`[OrderService] Deleted costumer with id: ${json.data}`)
    }

    // Handle product deletion
    if (job === "delete_product") {
        //Delete a product
        const deletedProduct = await dbService.deleteProduct(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            type: "Delete",
            name: `Delete product at ${date}`,
            description: `Delete the product with id ${json.data} at ${date}`,
            date: date,
            data: json.data
        })

        console.log(`[OrderService] Deleted product with id: ${json.data}`)
    }

    // Handle update the order status
    if (job === "update_status") {
        // Update the order status (forward-only). result.applied tells us if it changed.
        const result = await dbService.updateOrderStatus(json.data.orderId, json.data.orderStatus);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            type: "Update",
            name: `Update order status at ${date}`,
            description: `Update the order status of the order with id ${json.data.orderId} at ${date}`,
            date: date,
            data: json.data
        })

        // Publish event to the order read service
        await publishMessage("local_exchange", "order_read_service", "order_status_updated", "handel_event", {}, log);

        console.log(`[OrderService] Updated order status of order ${json.data.orderId} to ${json.data.orderStatus}`)
    }
}
