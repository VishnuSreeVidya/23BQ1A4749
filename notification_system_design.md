# Stage 1: REST API Design & Real-Time Mechanism

## 1. Core Endpoints & API Contract

### A. Fetch Notifications
- **Endpoint:** `GET /api/v1/notifications`
- **Description:** Retrieves a paginated list of system-wide notifications for the logged-in student.
- **Headers:**
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  Accept: application/json
  ```
- **Query Parameters:**
  | Parameter | Type   | Required | Default | Description                                      |
  |-----------|--------|----------|---------|--------------------------------------------------|
  | page      | number | No       | 1       | Page number for pagination                       |
  | limit     | number | No       | 20      | Number of records per page                       |
  | notification_type | string | No | all     | Filter by type: `Placement`, `Result`, `Event`   |

- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "notif_001",
        "student_id": "stu_123",
        "type": "Placement",
        "title": "Amazon Off-Campus Drive",
        "message": "SDE intern roles for third-year students.",
        "is_read": false,
        "created_at": "2026-06-05T09:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total_items": 142,
      "total_pages": 8
    }
  }
  ```

### B. Mark Notification as Read
- **Endpoint:** `PATCH /api/v1/notifications/{id}/read`
- **Description:** Marks a single notification as read for the authenticated student.
- **Headers:**
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Path Parameters:**
  | Parameter | Type   | Description                        |
  |-----------|--------|------------------------------------|
  | id        | string | The unique identifier of the notification |

- **Request Body:** (empty — identity is inferred from JWT)
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "message": "Notification marked as read."
  }
  ```
- **Response `404 Not Found`:**
  ```json
  {
    "success": false,
    "error": "Notification not found."
  }
  ```

## 2. Real-Time Mechanism: SSE vs WebSockets

**Architectural decision: Server-Sent Events (SSE) over WebSockets.**

| Factor | SSE | WebSockets |
|--------|-----|------------|
| Communication direction | Unidirectional (server → client) | Bidirectional (full-duplex) |
| Complexity | Low — built on standard HTTP | High — requires upgrade handshake, frame protocol |
| Browser support | Native `EventSource` API | Requires custom client logic |
| Reconnection | Automatic with last-event-id | Manual implementation needed |
| Firewall friendly | Uses standard HTTP ports | May be blocked by enterprise proxies |
| Scalability | Stateless HTTP — easy to load balance | Stateful connections — harder to scale horizontally |

**Justification:** Notifications in this system are strictly server-pushed to clients (students never send data back over the real-time channel). SSE is the correct choice because:

1. **Unidirectional fit** — The system only needs to push new notifications from server to client. WebSockets would introduce unnecessary bidirectional complexity.
2. **Simpler infrastructure** — SSE uses standard HTTP, works through existing proxies/firewalls, and integrates naturally with REST-based authentication (JWT tokens in the initial request).
3. **Auto-reconnect** — The `EventSource` API natively reconnects on dropped connections with `Last-Event-ID` headers, eliminating custom heartbeat logic.
4. **Lower overhead** — No frame parsing, no ping/pong frames, no upgrade handshake. Pure HTTP streaming.
5. **Cache-friendly** — SSE streams can be cached by CDN intermediaries for broadcast-style notifications.

---

# Stage 2: Database Selection & Scalability Schema

## 1. Database Selection: PostgreSQL

**PostgreSQL is selected as the primary database** for the following ACID-compliant reasons:

| Property | How PostgreSQL Satisfies It |
|----------|-----------------------------|
| **Atomicity** | Transactions via `BEGIN`/`COMMIT`/`ROLLBACK` ensure that marking a notification as read and updating the cache invalidation log happen atomically. |
| **Consistency** | Foreign key constraints, `CHECK` constraints, and strict type enforcement prevent orphaned read-states and invalid notification types. |
| **Isolation** | MVCC (Multi-Version Concurrency Control) allows concurrent reads without writer blocking — critical when thousands of students poll simultaneously. |
| **Durability** | Write-Ahead Logging (WAL) ensures no data loss on crash. Synchronous replication to a standby node provides additional safety. |

**Why not NoSQL?** The relational model is essential here because:
- Read state is inherently a many-to-many relationship (student × notification).
- ACID compliance is required to guarantee that cache invalidations and read-status updates stay consistent.
- JOIN-based queries across `students`, `notifications`, and `student_notifications` are frequent and well-supported by PostgreSQL's query planner.

## 2. Schema Design

```sql
-- Students table
CREATE TABLE students (
    student_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        VARCHAR(255) UNIQUE NOT NULL,
    full_name    VARCHAR(255) NOT NULL,
    department   VARCHAR(100),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table (broadcast messages)
CREATE TABLE notifications (
    notification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type             VARCHAR(50) NOT NULL CHECK (type IN ('Placement', 'Result', 'Event')),
    title            VARCHAR(255) NOT NULL,
    message          TEXT NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many mapping: student_notifications (tracks per-student read state)
-- Denormalized created_at is copied from notifications at insert time
-- to support the composite index requirement for fast lookup sorting
CREATE TABLE student_notifications (
    student_id       UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    notification_id  UUID NOT NULL REFERENCES notifications(notification_id) ON DELETE CASCADE,
    is_read          BOOLEAN DEFAULT FALSE,
    read_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL,  -- denormalized from notifications for index performance
    PRIMARY KEY (student_id, notification_id)
);
```

**Why a mapping table?** Each notification is broadcast to all students. Without a separate `student_notifications` table, we would need to either:
- Duplicate the notification row per student (massive storage waste), or
- Store a JSON array of read-IDs per student (poor query performance).

The mapping table cleanly normalizes the read-state relationship and supports indexing for fast lookups. The `created_at` column is denormalized from `notifications` into `student_notifications` at broadcast time — this storage trade-off (a few extra bytes per row) enables the composite index `(student_id, is_read, created_at DESC)` to serve sorted queries without a join-based sort.

## 3. Horizontal Scaling Strategy

### Horizontal Partitioning (by timestamp)
```sql
CREATE TABLE notifications_2026_06 PARTITION OF notifications
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE notifications_2026_07 PARTITION OF notifications
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```
- `notifications` and `student_notifications` are range-partitioned by `created_at`.
- Queries that filter by date (e.g., "last 7 days") only scan relevant partitions — drastically reducing I/O.

### Primary-Replica Read/Write Splitting
```
┌──────────────┐     Writes       ┌──────────────┐
│  Application  │ ──────────────> │   Primary    │
│   (Writes)    │                 │  (Read/Write) │
└──────────────┘                 └──────┬───────┘
                                        │
                          WAL Streaming │ (synchronous)
                                        ▼
┌──────────────┐                 ┌──────────────┐
│  Application  │ <────────────── │   Replica 1  │
│   (Reads)     │                 │  (Read-only) │
└──────────────┘                 └──────────────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │   Replica N  │
                                 │  (Read-only) │
                                 └──────────────┘
```
- All `INSERT` / `UPDATE` / `DELETE` goes to the **primary** node.
- Read-heavy queries (fetch notifications, check read status) hit **read replicas**.
- WAL streaming keeps replicas near real-time.

## 4. Scalability Constraint: 50,000 Concurrent Users

| Dimension | Calculation | Headroom |
|-----------|-------------|----------|
| **Daily active users** | 50,000 students | — |
| **Peak concurrent requests** | 50,000 × 20% concurrency = 10,000 req/s | Replica pool handles 20,000+ read QPS |
| **Notification broadcast throughput** | 1 broadcast × 50,000 inserts = 50,000 rows/write | Batch INSERT (500/statement) + worker pool |
| **Cache hit ratio** | ~85% for repeated inbox refreshes | Redis cluster with 2 GB memory per node |
| **SSE connections** | 50,000 concurrent long-lived connections | Stateless HTTP — load-balanced across 8 nodes |

**How each stage handles 50K users:**
- **Stage 1 (REST)** — Stateless API servers behind a load balancer; each request is independent.
- **Stage 2 (Database)** — 3 read replicas absorb the query load; primary only handles writes.
- **Stage 3 (Indexing)** — The composite index reduces per-query cost to < 5 ms even at 10,000 QPS.
- **Stage 4 (Caching)** — Redis cache-aside cuts database reads by 85%.
- **Stage 5 (Async)** — RabbitMQ decouples the 50,000-insert broadcast from the request-response path; workers scale horizontally to match throughput.

---

# Stage 3: SQL Query Analysis & Indexing Strategy

## 1. Full-Table Scan Analysis (5,000,000 rows)

Without proper indexing, the following query triggers a **sequential full-table scan**:

```sql
SELECT n.*, sn.is_read
FROM notifications n
JOIN student_notifications sn ON n.notification_id = sn.notification_id
WHERE sn.student_id = 'stu_123'
  AND sn.is_read = FALSE
ORDER BY n.created_at DESC;
```

**Why it happens:**
- The query planner has no index on `student_notifications.student_id` or `is_read`.
- Without an index, PostgreSQL must scan all 5,000,000 rows in `student_notifications` sequentially.
- On a typical spinning disk (≈ 200 IOPS, 100 MB/s sequential read), scanning 5M rows (≈ 500 MB) takes **4–8 seconds**.
- Even on SSDs (≈ 500 MB/s), this is **1–2 seconds** of unnecessary sequential IO — unacceptable for a user-facing inbox.

## 2. Composite Index for Lookup Optimization

```sql
CREATE INDEX idx_student_read_time
ON student_notifications (student_id, is_read, created_at DESC);
```

**Why this composite index:**
- **`student_id`** (leftmost) — filters immediately to one student's rows (reduces scan to ~thousands instead of millions).
- **`is_read`** — further filters to only unread rows (typically a small subset).
- **`created_at DESC`** — enables a backward index scan to serve `ORDER BY created_at DESC` directly without an additional sort step, making the top-N query highly efficient.

With this index, the same query completes in **< 5 ms** because it reads fewer than 100 index entries instead of 5M heap rows.

## 3. Optimized SQL: Placement Notifications Last 7 Days

```sql
SELECT n.notification_id,
       n.type,
       n.title,
       n.message,
       n.created_at,
       sn.is_read
FROM notifications n
JOIN student_notifications sn
    ON n.notification_id = sn.notification_id
WHERE sn.student_id = 'stu_123'
  AND sn.is_read = FALSE
  AND n.type = 'Placement'
  AND n.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY n.created_at DESC
LIMIT 20;
```

**Optimizations applied:**
- **`DATE_SUB(NOW(), INTERVAL 7 DAY)`** — sargable filter that can use the range partition pruning (Stage 2.3) and the B-tree index on `created_at`.
- **`LIMIT 20`** — avoids fetching all matching rows; stops after retrieving the page size.
- **Composite index usage** — the query hits `idx_student_read_time` first, then joins to `notifications` via the primary key.

---

# Stage 4: High-Volume Traffic Optimization

## 1. Redis Cache-Aside Pattern

```
┌──────────┐    1. Read(key)    ┌──────────┐
│  Client  │ ─────────────────> │  Redis   │
└──────────┘                    └────┬─────┘
       │                              │
       │ 2a. Cache HIT ──────────────┘ Return data
       │
       │ 2b. Cache MISS
       ▼
┌──────────┐    3. Fetch from DB   ┌──────────┐
│  Client  │ <─────────────────── │   SQL    │
└──────────┘                      │  Primary │
       │                          └──────────┘
       │ 4. Write to cache
       ▼
   ┌──────────┐
   │  Redis   │  TTL: 300 seconds
   └──────────┘
```

**Implementation:**
```python
def get_notifications(student_id, page, limit, notification_type):
    cache_key = f"notifications:{student_id}:{page}:{limit}:{notification_type}"

    # 1. Try cache
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    # 2. Cache MISS — fetch from PostgreSQL replica
    data = db.query("""
        SELECT ... FROM notifications n
        JOIN student_notifications sn ...
        WHERE sn.student_id = :sid ...
    """, params={"sid": student_id})

    # 3. Store in cache with TTL
    redis.setex(cache_key, 300, json.dumps(data))  # 5 minute TTL

    return data
```

**Benefits:**
- Reduces database read load by **80–90%** for repeated queries (e.g., students refreshing their inbox).
- Sub-millisecond response times for cached data vs. 5–50 ms for database queries.

## 2. Cache Invalidation on Read

When a student marks a notification as read, we must invalidate the cache to prevent **dirty reads** (showing a stale unread notification):

```python
def mark_as_read(student_id, notification_id):
    # 1. Update database (primary node)
    db.execute("""
        UPDATE student_notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE student_id = :sid AND notification_id = :nid
    """, params={"sid": student_id, "nid": notification_id})

    # 2. Invalidate all cached notification lists for this student
    pattern = f"notifications:{student_id}:*"
    cursor = 0
    while True:
        cursor, keys = redis.scan(cursor=cursor, match=pattern, count=100)
        if keys:
            redis.delete(*keys)
        if cursor == 0:
            break
```

**Why scan + delete instead of a single key?** The student's inbox may be cached under multiple page/limit/filter variants. Deleting by pattern ensures all stale variants are evicted.

---

# Stage 5: Distributed Systems & Mass Broadcasts

## 1. Why Synchronous `for` Loop Fails

```python
# BAD — synchronous broadcast
def broadcast_notification(notification):
    all_students = db.query("SELECT student_id FROM students")  # 10,000 students
    for student in all_students:                                 # Synchronous loop
        db.execute("""
            INSERT INTO student_notifications (student_id, notification_id, is_read)
            VALUES (:sid, :nid, FALSE)
        """, params={"sid": student["student_id"], "nid": notification["id"]})
        send_realtime_event(student["student_id"], notification)  # SSE push
```

**Problems:**
1. **Thread blocking** — The entire loop runs in a single thread. Each database INSERT takes ~5 ms, so 10,000 students = **50 seconds** of blocking. During this time, the server cannot process any other requests.
2. **No failure isolation** — If the 5,000th INSERT fails, the entire broadcast is rolled back (or worse, partially applied with no recovery).
3. **No backpressure** — If the database slows down under write load, the loop simply queues up more queries, exacerbating the problem.
4. **Poor user experience** — Students at the end of the loop receive their notification nearly a minute after students at the front.

## 2. Asynchronous Message Broker Architecture (RabbitMQ)

```
┌──────────────┐     Publish      ┌──────────────┐     Consume     ┌──────────────┐
│  API Server  │ ───────────────> │   RabbitMQ   │ ──────────────> │   Worker 1   │
│ (Broadcast)  │                  │   Exchange   │                 │  (Consumer)  │
└──────────────┘                  └──────────────┘                 └──────┬───────┘
                                                                         │
                                                                         │ INSERT
                                                                         ▼
                                                                  ┌──────────────┐
                                                                  │  PostgreSQL  │
                                                                  │   Primary    │
                                                                  └──────────────┘
```

**Workflow:**
1. **Producer** (API server) publishes a single `notification.broadcast` message to RabbitMQ when admin creates a notification.
2. **Exchange** routes the message to a durable queue (`notification_queue`).
3. **Consumers** (background workers, 10–20 instances) pull messages from the queue:
   - Each worker picks a batch of students (e.g., 500 at a time).
   - Workers use bulk INSERT statements for efficiency.
   - Workers push SSE events in parallel batches.
4. **On failure:** The message is requeued with a retry limit. Dead-letter queue captures permanent failures.

**Benefits:**
- **Decoupled ingestion vs. delivery** — API server responds immediately; workers process asynchronously.
- **Horizontal scaling** — Add more workers to handle larger student populations.
- **Backpressure** — RabbitMQ's prefetch count prevents workers from overwhelming the database.
- **Fault tolerance** — If a worker crashes, its unacknowledged messages are redistributed to other workers.
- **Persistence** — Messages survive broker restarts via disk-backed queues.

---

# Cross-Cutting: Logging Middleware

## 1. Purpose

Every API request in the notification system must be logged with:
- Timestamp and unique request ID
- HTTP method and URL
- Request headers (with sensitive fields like `Authorization` redacted)
- Request body (if present)
- Response status code
- Response duration in milliseconds

## 2. Implementation (`logging-middleware.js`)

The logging middleware is implemented as a reusable class with two modes:

### A. Express Middleware Mode (server-side)

```javascript
import LoggingMiddleware from './logging-middleware.js';

const logger = new LoggingMiddleware();
app.use(logger.expressMiddleware);
```

**Output:**
```
[2026-06-05 10:30:00.123] [a1b2c3] → GET /api/v1/notifications?page=1&limit=20
[2026-06-05 10:30:00.145] [a1b2c3] ✓ GET /api/v1/notifications?page=1&limit=20 → 200 — 22ms
```

### B. Functional Wrapper Mode (for any async call)

```javascript
const wrappedFetch = logger.wrap(
    () => fetch('/api/v1/notifications'),
    { method: 'GET', url: '/api/v1/notifications' }
);
```

### C. Key Design Decisions

| Concern | Implementation |
|---------|---------------|
| **Sensitive redaction** | `Authorization`, `Cookie`, `X-Api-Key` headers are replaced with `***` before logging |
| **Request tracing** | `crypto.randomUUID()` generates a unique request ID per call |
| **Duration measurement** | `performance.now()` delta between ENTER and EXIT |
| **Error logging** | Failed requests log at `console.error` level with the error message |
| **Separation of concerns** | The logging class does not touch business logic — it wraps and delegates |

## 3. Integration With All Stages

```
┌──────────────┐     Logged      ┌──────────────┐
│   Client     │ ──────────────> │    API GW    │
│   (React)    │                 │  (Middleware) │
└──────────────┘                 └──────┬───────┘
                                        │
                              ┌─────────▼─────────┐
                              │   LoggingMiddleware │
                              │   - request ID      │
                              │   - timing          │
                              │   - sanitize headers│
                              └─────────┬─────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             ┌──────────┐       ┌──────────┐       ┌──────────┐
             │  Redis    │       │   API    │       │ RabbitMQ │
             │  Cache    │       │  Logic   │       │  Queue   │
             └──────────┘       └──────────┘       └──────────┘
```

Every inbound request passes through the middleware before reaching the cache, business logic, or queue producer — ensuring observability across the entire stack.
