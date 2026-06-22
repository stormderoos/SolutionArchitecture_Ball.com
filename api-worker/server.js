/**
 * Import base packages
 */
const redis = require("redis");
const amqp = require("amqplib");

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT || 6379);
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";

/**
 * Setup redis
 */
const redisClient = redis.createClient({
    socket: {
        host: redisHost,
        port: redisPort
    }
});

/**
 * Global rabbitmq channel
 */
let rabbitmqChannel = null;

/**
 * Main application loop
 */
const run = async () => {
    await redisClient.connect().catch((e) => {
        console.error(e);
        process.exit(1);
    });
    console.log(`[Redis] Connected: ${redisHost}:${redisPort}`);

    const connection = await amqp.connect(rabbitmqUrl);
    console.log(`[RabbitMQ] Connected: ${rabbitmqUrl}`);
    rabbitmqChannel = await connection.createChannel();
    console.log(`[RabbitMQ] Created Channel`);
    await rabbitmqChannel.assertExchange("local_exchange", "direct", {
        durable: true
    });
    console.log(`[RabbitMQ] Asserted Exchange: local_exchange`);
    await rabbitmqChannel.assertQueue("local_api_worker", { durable: true });
    console.log(`[RabbitMQ] Asserted Queue: local_api_worker`);
    await rabbitmqChannel.bindQueue(
        "local_api_worker",
        "local_exchange",
        "local_api_worker"
    );
    console.log(`[RabbitMQ] Bound Queue: local_exchange -> local_api_worker`);

    rabbitmqChannel.consume("local_api_worker", (message) => {
        const json = JSON.parse(message.content.toString());
        console.log(
            `[RabbitMQ][${json.meta.uuid}] Message Received: ${JSON.stringify(json)}`
        );

        // App logic here
        redisClient.set(json.meta.uuid, JSON.stringify(json.data));
        rabbitmqChannel.ack(message);
    });
};

run();

