// Imports
const amqp = require("amqplib");
const express = require("express");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");
const { getOrder, getEventLog } = require("./dbRepository");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    await createChannel("order_service", "local_exchange", "order_service");

    // Consume messages
    rabbitmqChannel.consume("order_service", async (message) => {
        const json = JSON.parse(message.content.toString());

        console.log(`[OrderService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`);

        // Handle update product
        if (json.meta.job === "update_product") {
            // Update the product
            let product = dbService.updateProduct(meta.data);

            // Add the event to history
            const date = new Date()
            const log = dbService.createEventLog({
                name: `Update product at ${date}`,
                description: `Update the product with id ${meta.data.productId} at ${date}`,
                date: date
            })

            console.log(`Updated product: ${product}`)
        }

        // Handle update costumer
        if (json.meta.job === "update_costumer") {
            // Update the costumer
            let costumer = dbService.updateCostumer(meta.data);

            // Add the event to history
            const date = new Date()
            const log = dbService.createEventLog({
                name: `Update costumer at ${date}`,
                description: `Update the costumer with id ${meta.data.costumerId} at ${date}`,
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
            const log = dbService.createEventLog({
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
            const log = dbService.createEventLog({
                name: `Created costumer at ${date}`,
                description: `Created the costumer with id ${costumer.costumerId} at ${date}`,
                date: date
            })

            console.log(`[OrderService] Created costumer with id: ${costumer.costumerId}`)
        }

        // Handle costumer deletion
        if (json.meta.job === "delete_costumer") {
            //Delete a costumer
            const deletedCostumer = dbService.deleteCostumer(json.data);

            // Add the event to history
            const date = new Date()
            const log = dbService.createEventLog({
                name: `Delete costumer at ${date}`,
                description: `Delete the costumer with id ${json.data} at ${date}`,
                date: date
            })

            console.log(`[OrderService] Deleted costumer with id: ${json.data}`)
        }

        // Handle product deletion
        if (json.meta.job === "delete_product") {
            //Delete a product
            const deletedProduct = dbService.deleteProduct(json.data);

            // Add the event to history
            const date = new Date()
            const log = dbService.createEventLog({
                name: `Delete product at ${date}`,
                description: `Delete the product with id ${json.data} at ${date}`,
                date: date
            })

            console.log(`[OrderService] Deleted product with id: ${json.data}`)
        }

        // Handle update the order status
        if (json.meta.job === "update_status") {
            // Update the order status
            const order = dbService.updateOrderStatus(json.data.orderId, json.data.orderStatus);

            // Add the event to history
            const date = new Date()
            const log = await dbService.createEventLog({
                name: `Update order status at ${date}`,
                description: `Update the order status of the order with id ${order.orderId} at ${date}`,
                date: date
            })

            console.log(`[OrderService] Updated order: ${order}`)
        }

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
app.post("/order/create", async (req, res) => {
    console.log("req.body", req.body);
    await createOrder(req.body);
});

// Update an order
app.post("/order/update", async (req, res) => {
    console.log("req.body", req.body);
    await updateOrder(req.body);
});

// Get an order
app.get("/order", async (req, res) => {
    console.log("req.body", req.body);
    await getOrder(req.body);
});

// Delete an order
app.delete("/order", async (req, res) => {
    console.log("req.body", req.body);
    await deleteOrder(req.body);
});

// Get a event log
app.get("/event", async (req, res) => {
    console.log("req.body", req.body);
    await dbService.getEventLog(req.body);
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
    const createdOrder = await dbService.createOrder(request.order, request.orderProducts)

    // Publish event to the warehouse service
    rabbitmqChannel.publish(
        "local_exchange",
        "warehouse_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_created",
                    job: "move_product"
                },
                data: {
                    order: createdOrder,
                    products: request.products
                }
            })
        ),
        { persistent: true }
    );

    // Publish event to the payment service
    rabbitmqChannel.publish(
        "local_exchange",
        "payment_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_created",
                    job: "start_payment"
                },
                data: createdOrder
            })
        ),
        { persistent: true }
    );

    // Publish event to the costumer service
    rabbitmqChannel.publish(
        "local_exchange",
        "costumer_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_created",
                    job: "add_order"
                },
                data: createdOrder
            })
        ),
        { persistent: true }
    );

    // Add the event to history
    const date = new Date()
    const log = dbService.createEventLog({
        name: `Created order at ${date}`,
        description: `Created a new order with order id ${order.orderId} at ${date}`,
        date: date
    })

    console.log(`[OrderService] Order created and event published`);
}

// Update a order
const updateOrder = async (request) => {
    // Handle order update
    console.log(`[OrderService] Updateing order ${request.order.orderId}`);

    // Update order in database
    const updatedOrder = await dbService.updateOrder(request.order)

    // Publish event to the warehouse service
    rabbitmqChannel.publish(
        "local_exchange",
        "warehouse_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_updated",
                    job: "update_order"
                },
                data: updatedOrder
            })
        ),
        { persistent: true }
    );

    // Publish event to the payment service
    rabbitmqChannel.publish(
        "local_exchange",
        "payment_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_updated",
                    job: "update_order"
                },
                data: updatedOrder
            })
        ),
        { persistent: true }
    );

    // Publish event to the costumer service
    rabbitmqChannel.publish(
        "local_exchange",
        "costumer_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_updated",
                    job: "update_order"
                },
                data: updatedOrder
            })
        ),
        { persistent: true }
    );

    // Publish event to the warehouse service
    rabbitmqChannel.publish(
        "local_exchange",
        "warehouse_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_updated",
                    job: "update_order"
                },
                data: updatedOrder
            })
        ),
        { persistent: true }
    );

    // Add the event to history
    const date = new Date()
    const log = dbService.createEventLog({
        name: `Updated order at ${date}`,
        description: `Updated the order with order id ${order.orderId} at ${date}`,
        date: date
    })

    console.log(`[OrderService] Order updated and event published`);
}

// Delete a order
const deleteOrder = async (request) => {
    // Handle order delete
    console.log(`[OrderService] Deleteing order ${request.orderId}`);

    // Delte the order from the database
    deletedOrder = await dbService.deleteOrder(request.orderId)

    // Publish event to the warehouse service
    rabbitmqChannel.publish(
        "local_exchange",
        "warehouse_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_deleted",
                    job: "delete_order"
                },
                data: request.orderId
            })
        ),
        { persistent: true }
    );

    // Publish event to the payment service
    rabbitmqChannel.publish(
        "local_exchange",
        "payment_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_deleted",
                    job: "delete_order"
                },
                data: request.orderId
            })
        ),
        { persistent: true }
    );

    // Publish event to the costumer service
    rabbitmqChannel.publish(
        "local_exchange",
        "costumer_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_deleted",
                    job: "delete_order"
                },
                data: request.orderId
            })
        ),
        { persistent: true }
    );

    // Publish event to the warehouse service
    rabbitmqChannel.publish(
        "local_exchange",
        "warehouse_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "order_deleted",
                    job: "delete_order"
                },
                data: request.orderId
            })
        ),
        { persistent: true }
    );

    // Add the event to history
    const date = new Date()
    const log = dbService.createEventLog({
        name: `Deleted order at ${date}`,
        description: `Delted the order with order id ${request.orderId} at ${date}`,
        date: date
    })

    console.log(`[OrderService] Order deleted and event published`);
}

// Get a order
const getOrder = async (request) => {
    console.log(`[OrderService] Getting order ${request.orderId}`);

    // Get the order from the database
    const order = dbService.getOrder(request.orderId);

    console.log(`Order: ${order}`);
}

// Create a new channel
async function createChannel(queueName, sourceName, pattern) {
    // Connect to rabbitMQ
    const connection = await amqp.connect(rabbitmqUrl);
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
