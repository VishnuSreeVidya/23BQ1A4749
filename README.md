# Campus Notification Platform

A full-stack notification system for campus-wide announcements, built for the Afford Medical Technologies assessment.

---

## Folder Structure

```
23BQ1A4749/
│
├── logging_middleware/                  # Mandatory logging middleware
│   └── logger.ts                        # TypeScript Logger — request IDs, timing, header sanitization
│
├── notification_app_be/                 # Backend microservice (Express + Redis + RabbitMQ)
│   ├── package.json
│   ├── server.js                        # Express entry point (port 3001)
│   ├── .env.example                     # Environment variable template
│   └── src/
│       ├── config.js                    # App configuration
│       ├── middleware/
│       │   └── logging.js               # Wraps logger.ts into Express middleware
│       ├── routes/
│       │   └── notifications.js         # GET /api/v1/notifications + PATCH .../{id}/read
│       └── services/
│           ├── cache.js                 # Redis cache-aside (get/set/invalidate)
│           └── queue.js                 # RabbitMQ producer/consumer
│
├── notification_app_fe/                 # Frontend dashboard (Vite + React 18 + TypeScript)
│   ├── index.html                       # Vite entry with global styles
│   ├── package.json
│   ├── vite.config.ts                   # Port 3000, proxies /api → backend :3001
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── src/
│       ├── main.tsx                      # React bootstrap (createRoot)
│       ├── App.tsx                       # Main dashboard — state, fetch, mark-as-read
│       └── utils/
│           └── prioritySort.ts           # Weighted sorting algorithm (Placement > Result > Event)
│
├── notification_system_design.md        # Full architecture document (all 7 stages)
└── README.md                            # This file
```

---

## The 7 Stages

### Stage 1 — REST API Design & Real-Time Mechanism

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/notifications` | `GET` | Fetch paginated notifications with `page`, `limit`, `notification_type` query params |
| `/api/v1/notifications/{id}/read` | `PATCH` | Mark a single notification as read |

**Real-time:** Server-Sent Events (SSE) chosen over WebSockets — unidirectional push, auto-reconnect, lower overhead, firewall-friendly.

**Sample response:**
```json
{
    "success": true,
    "data": [ { "id": "notif_001", "type": "Placement", "title": "...", "is_read": false, "created_at": "2026-06-05T09:30:00Z" } ],
    "pagination": { "page": 1, "limit": 20, "total_items": 142, "total_pages": 8 }
}
```

---

### Stage 2 — Database Schema & Scalability

**Database:** PostgreSQL (ACID — Atomicity, Consistency, Isolation, Durability).

**Schema:**
- `students` — student profiles (UUID PK, email, name, department)
- `notifications` — broadcast messages (UUID PK, type, title, message, created_at)
- `student_notifications` — many-to-many mapping tracking per-student read state (student_id, notification_id, is_read, created_at)

**Scaling:**
- Horizontal range partitioning by `created_at` (monthly partitions)
- Primary node for writes, read replicas for queries
- Designed for 50,000 concurrent users

---

### Stage 3 — SQL Query Analysis & Indexing

**Problem:** `SELECT * FROM student_notifications WHERE student_id = ? AND is_read = FALSE` on 5M rows triggers a sequential full-table scan (4–8 seconds on HDD, 1–2s on SSD).

**Solution — Composite Index:**
```sql
CREATE INDEX idx_student_read_time ON student_notifications (student_id, is_read, created_at DESC);
```

**Optimized Query (Placement notifications, last 7 days):**
```sql
SELECT n.*, sn.is_read
FROM notifications n
JOIN student_notifications sn ON n.notification_id = sn.notification_id
WHERE sn.student_id = 'stu_123' AND sn.is_read = FALSE
  AND n.type = 'Placement' AND n.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY n.created_at DESC LIMIT 20;
```

---

### Stage 4 — High-Volume Traffic Optimization

**Redis Cache-Aside Pattern:**
1. Read from cache → if hit, return
2. Cache miss → fetch from PostgreSQL replica
3. Store in Redis with 300s TTL

**Cache Invalidation:** When a student marks a notification as read, all cached variants for that student are evicted via `SCAN pattern:notifications:{student_id}:*` + `DELETE`.

---

### Stage 5 — Asynchronous Mass Broadcast

**Problem:** A synchronous `for` loop inserting 50,000 rows blocks the server thread for ~50 seconds.

**Solution — RabbitMQ:**
- API server publishes a single `notification.broadcast` message
- Background workers (10–20 instances) consume the queue in parallel
- Each worker batch-inserts 500 rows at a time
- Dead-letter queue handles failures with retry

---

### Stage 6 — Priority Sorting Engine

**Weight hierarchy:** Placement (3) → Result (2) → Event (1)

```typescript
// prioritySort.ts
export function processNotifications(notifications: Notification[]): Notification[] {
    return notifications
        .filter(n => !n.isRead)
        .sort((a, b) => {
            const w = getPriorityWeight(b.type) - getPriorityWeight(a.type);
            return w !== 0 ? w : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 10);
}
```

---

### Stage 7 — Frontend Dashboard

Built with **Vite + React 18 + TypeScript**.

Features:
- Dark-themed priority inbox with color-coded borders (red = Placement, blue = Result, green = Event)
- Green pulsing live beacon indicator
- Hover elevation with colored shadow glow
- "✓ Mark as Read" button with scale(0.96) active feedback
- Smooth fade+shrink dismissal animation (300ms)
- Event delegation for click handling
- API fetch with automatic fallback to mock data

**To run:**
```bash
cd notification_app_fe
npm install
npm run dev     # → http://localhost:3000
```

---

## Logging Middleware

Every API request passes through `LoggingMiddleware` (in `logging_middleware/logger.ts`):
- Generates unique request ID (`crypto.randomUUID()`)
- Logs method, URL, sanitized headers, status code, response time
- Redacts sensitive headers (`Authorization`, `Cookie`, `X-Api-Key`)
- Supports Express middleware and functional wrapper modes

---

## How to Run (Fullstack)

```bash
# Terminal 1 — Backend
cd notification_app_be
npm install
npm run dev     # → http://localhost:3001

# Terminal 2 — Frontend
cd notification_app_fe
npm install
npm run dev     # → http://localhost:3000 (proxies /api → :3001)
```

The frontend dev server proxies `/api/*` requests to the backend on port 3001.
