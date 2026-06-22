# RabbitMQ Microservices

This repository demonstrates a small microservices setup built with Node.js,
RabbitMQ, and Redis. The services run together using Docker Compose.

## Services

- `web`: Browser-facing UI on <http://localhost:3000>
- `api`: HTTP API on <http://localhost:4000>
- `api-worker`: Background worker that stores results in Redis
- `special-worker`: Background worker that transforms queued jobs
- `redis`: Shared inmemory data store
- `rabbitmq`: Message broker with management UI on <http://localhost:15672>

## Run The Stack

1. Start everything from the repository root:

    ```powershell
    docker compose up --build
    ```

2. Open the web app in your browser: <http://localhost:3000>. Sending a JSON
   message should result in the same message with reverted keys and values.

3. Optional: open the RabbitMQ management UI and log in with the default
   guest/guest credentials: <http://localhost:15672>

## How It Works

- `web` sends jobs to RabbitMQ.
- `special-worker` consumes the job, processes it, and publishes the result
  back.
- `api-worker` stores the final result in Redis.
- `api` exposes the HTTP endpoint used to retrieve stored job results.

## Notes

- The containers are configured to talk to each other through Compose service
  names.
- If you change ports or broker settings, update `docker-compose.yml` and the
  service environment variables together.

## License

MIT

