# Notification App — Backend

This directory serves as the reference track for the backend microservice implementation.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/notifications` | Fetch paginated notifications (`page`, `limit`, `notification_type`) |
| `PATCH` | `/api/v1/notifications/{id}/read` | Mark a notification as read |

## Architecture

- **Runtime:** Node.js with Express
- **Database:** PostgreSQL (ACID-compliant)
- **Cache:** Redis (cache-aside pattern)
- **Queue:** RabbitMQ (async broadcast worker)
- **Logging:** Custom `LoggingMiddleware` (see `logging_middleware/logger.ts`)

## Scaling

Designed for 50,000 concurrent users via horizontal partitioning,
primary-replica read/write splitting, and async worker pools.

---

*Refer to `notification_system_design.md` for the full architecture document.*
