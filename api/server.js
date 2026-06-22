/**
 * Import base packages
 */
const express = require("express");
const redis = require("redis");
const { v4: uuidv4 } = require("uuid");
const amqp = require("amqplib");
// import { amqp } from "amqplib";
// import { } from "express";
// import { redis } from "redis";
// import { uuidv4 } from "uuid";

/**
 * Setup Express app
 */
const app = express();

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
 * Trust proxy
 */
app.enable("trust proxy");

/**
 * Enable body parsers
 */
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: false }));

/**
 * Request logger
 */
app.use((req, res, next) => {
    console.log(`[Web]: ${req.originalUrl}`);
    next();
});

/**
 * Allow CORS
 */
app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");
    res.set("Access-Control-Allow-Methods", "*");
    next();
});

/**
 * Configure routers
 */
app.post("/api/input", (req, res) => {
    console.log("req.body", req.body);

    const uuid = uuidv4();
    rabbitmqChannel.publish(
        "local_exchange",
        "local_special_worker",
        Buffer.from(
            JSON.stringify({
                meta: {
                    uuid,
                    job: "reverse"
                },
                data: req.body.data
            })
        )
    );

    res.json({
        uuid
    });
});
app.get("/api/poll/:uuid", async (req, res) => {
    console.log("req.params", req.params);

    res.json({
        data: JSON.parse(await redisClient.get(req.params.uuid))
    });
});

/**
 * Disable powered by header for security reasons
 */
app.disable("x-powered-by");

/**
 * Start listening on port
 */
app.listen(4000, "0.0.0.0", async () => {
    console.log(`[App] Running on: 0.0.0.0:4000`);

    await redisClient.connect().catch((e) => {
        console.error(e.error);
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

    await rabbitmqChannel.assertQueue("local_special_worker", {
        durable: true
    });
    console.log(`[RabbitMQ] Asserted Queue: local_special_worker`);

    await rabbitmqChannel.bindQueue(
        "local_special_worker",
        "local_exchange",
        "local_special_worker"
    );
    console.log(
        `[RabbitMQ] Bound Queue: local_exchange -> local_special_worker`
    );
});

