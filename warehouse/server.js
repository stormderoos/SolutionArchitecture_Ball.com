// Imports
const amqp = require("amqplib");
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
const dbService = require("./dbService");

// Global variables
let rabbitmqChannel = null;

// Main application loop
const run = async () => {
    await createChannel("warehouse_service", "local_exchange", "warehouse_service");

    // Consume messages
    rabbitmqChannel.consume("warehouse_service", async (message) => {
        const json = JSON.parse(message.content.toString());
        console.log(
            `[WarehouseService][${json.meta.uuid}] Received: ${JSON.stringify(json)}`
        );

        try {
            // Handle order creation
            if (json.meta.job === "move_product") {
                await moveProduct(json.data.order.orderId, json.data.products);
            }
        } catch (error) {
            // Log the error but do not crash the process or requeue forever (no poison-message loop)
            console.error(`[WarehouseService] Error handling message ${json.meta.uuid}:`, error);
        } finally {
            // Always remove the message from the queue
            rabbitmqChannel.ack(message);
        }
    });
};

run();

// Functions
// Move products
const moveProduct = async (orderId, productsToPick) => {
    // Handle product movement
    console.log(`[WarehouseService] Moving product...`);

    //Create a pick list to move the products to pick
    await dbService.createPickList(orderId, productsToPick);

    // Publish event to the order service
    rabbitmqChannel.publish(
        "local_exchange",
        "order_service",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid: crypto.randomUUID(),
                    event: "products_moved",
                    job: "update_status"
                },
                data: {
                    orderId: orderId,
                    orderStatus: "Picking products"
                }
            })
        ),
        { persistent: true }
    );

    console.log(`[WarehouseService] Products moved and event published`);
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
