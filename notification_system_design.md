# Stage 1: REST API Design & Real-Time Mechanism

## 1. Core Endpoints & API Contract

### A. Fetch Notifications
* **Endpoint:** `GET /api/v1/notifications`
* **Headers:**
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  Accept: application/json