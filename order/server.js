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
    await createChannel("order_service", "local_exchange", "order_service");

    // Consume messages
    rabbitmqChannel.consume("order_service", async (message) => {
        const json = JSON.parse(message.content.toString());

        console.log(`[OrderService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

        // Handel incomming messages
        await handelMessage(json);

        // Remove the message from the queue
        rabbitmqChannel.ack(message);
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

// Get a event log
app.get("/event", async (req, res) => {
    try {
        console.log("[OrderService] Event logs get all");
        const result = await dbService.getEventLogs();
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

    // Set the data to send
    const dataToSend = {
        order: createdOrder,
        products: request.products
    }

    // Publish event to the warehouse service
    await publishMessage("local_exchange", "warehouse_service", "order_created", "move_product", dataToSend);

    // Publish event to the payment service
    await publishMessage("local_exchange", "payment_service", "order_created", "start_payment", dataToSend);

    // Publish event to the costumer service
    await publishMessage("local_exchange", "costumer_service", "order_created", "add_order", dataToSend);

    // Publish event to the shipment service
    await publishMessage("local_exchange", "shipment_service", "order_created", "add_order", dataToSend);

    // Add the event to history
    const date = new Date()
    const log = dbService.createEventLog({
        name: `Created order at ${date}`,
        description: `Created a new order with order id ${createdOrder.orderId} at ${date}`,
        date: date
    })

    console.log(`[OrderService] Order with id ${createdOrder.orderId} created and event published`);

    return createdOrder;
}

// Update a order
const updateOrder = async (request) => {
    // Handle order update
    console.log(`[OrderService] Updateing order ${request.order.orderId}`);

    // Update order in database
    const updatedOrder = await dbService.updateOrder(request.order, request.products)

    // Set the data to send
    const dataToSend = updatedOrder

    // Publish event to the warehouse service
    await publishMessage("local_exchange", "warehouse_service", "order_updated", "update_pick_list", dataToSend);

    // Publish event to the payment service
    await publishMessage("local_exchange", "payment_service", "order_updated", "update_order", dataToSend);

    // Publish event to the costumer service
    await publishMessage("local_exchange", "costumer_service", "order_updated", "update_order", dataToSend);

    // Publish event to the shipment service
    await publishMessage("local_exchange", "shipment_service", "order_updated", "update_order", dataToSend);

    // Add the event to history
    const date = new Date()
    const log = dbService.createEventLog({
        name: `Updated order at ${date}`,
        description: `Updated the order with order id ${updatedOrder.orderId} at ${date}`,
        date: date
    })

    console.log(`[OrderService] Order updated and event published`);

    return updatedOrder;
}

// Delete a order
const deleteOrder = async (orderId) => {
    // Delte the order from the database
    deletedOrder = await dbService.deleteOrder(orderId);

    // Set the data to send
    const dataToSend = {
        orderId: orderId
    }

    // Publish event to the payment service
    await publishMessage("local_exchange", "payment_service", "order_deleted", "delete_order", dataToSend);

    // Publish event to the costumer service
    await publishMessage("local_exchange", "costumer_service", "order_deleted", "delete_order", dataToSend);

    // Publish event to the shipment service
    await publishMessage("local_exchange", "shipment_service", "order_deleted", "delete_order", dataToSend);

    // Add the event to history
    const date = new Date()
    const log = dbService.createEventLog({
        name: `Deleted order at ${date}`,
        description: `Delted the order with order id ${orderId} at ${date}`,
        date: date
    })

    console.log(`[OrderService] Order deleted and event published`);
}

// Get a order
const getOrder = async (orderId) => {
    console.log(`[OrderService] Getting order ${orderId}`);

    // Get the order from the database
    const order = await dbService.getOrder(orderId);

    console.log(`Order: ${order}`);

    return order;
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
async function handelMessage(json) {
    // Handle update product
    if (json.meta.job === "update_product") {
        // Update the product
        let product = await dbService.updateProduct(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            name: `Update product at ${date}`,
            description: `Update the product with id ${json.data.productId} at ${date}`,
            date: date
        })

        console.log(`Updated product: ${product}`)
    }

    // Handle update costumer
    if (json.meta.job === "update_costumer") {
        // Update the costumer
        let costumer = await dbService.updateCostumer(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            name: `Update costumer at ${date}`,
            description: `Update the costumer with id ${json.data.costumerId} at ${date}`,
            date: date
        })

        console.log(`Updated costumer: ${costumer}`)
    }

    // Handle add product
    if (json.meta.job === "add_product") {
        // Create a product
        const product = await dbService.createProduct(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            name: `Created product at ${date}`,
            description: `Created the product with id ${product.productId} at ${date}`,
            date: date
        })

        console.log(`[OrderService] Created product with id: ${product.productId}`)
    }

    // Handle add costumer
    if (json.meta.job === "add_costumer") {
        // Create a costumer
        const costumer = await dbService.createCostumer(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            name: `Created costumer at ${date}`,
            description: `Created the costumer with id ${costumer.costumerId} at ${date}`,
            date: date
        })

        console.log(`[OrderService] Created costumer with id: ${costumer.costumerId}`)
    }

    // Handle costumer deletion
    if (json.meta.job === "delete_costumer") {
        //Delete a costumer
        const deletedCostumer = await dbService.deleteCostumer(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            name: `Delete costumer at ${date}`,
            description: `Delete the costumer with id ${json.data} at ${date}`,
            date: date
        })

        console.log(`[OrderService] Deleted costumer with id: ${json.data}`)
    }

    // Handle product deletion
    if (json.meta.job === "delete_product") {
        //Delete a product
        const deletedProduct = await dbService.deleteProduct(json.data);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            name: `Delete product at ${date}`,
            description: `Delete the product with id ${json.data} at ${date}`,
            date: date
        })

        console.log(`[OrderService] Deleted product with id: ${json.data}`)
    }

    // Handle update the order status
    if (json.meta.job === "update_status") {
        // Update the order status
        const order = await dbService.updateOrderStatus(json.data.orderId, json.data.orderStatus);

        // Add the event to history
        const date = new Date()
        const log = await dbService.createEventLog({
            name: `Update order status at ${date}`,
            description: `Update the order status of the order with id ${order.orderId} at ${date}`,
            date: date
        })

        console.log(`[OrderService] Updated order status: ${order}`)
    }
}
