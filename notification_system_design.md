# Stage 1: REST API Design & Real-Time Mechanism

## 1. Core Endpoints & API Contract

### A. Fetch Notifications
* **Endpoint:** `GET /api/v1/notifications`
* **Description:** Retrieves a paginated list of system-wide notifications for the logged-in student.
* **Headers:**
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  Accept: application/json