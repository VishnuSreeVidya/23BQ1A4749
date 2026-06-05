# Notification Service System
This repository contains the full-stack implementation for the **Afford Medical Technologies** campus hiring evaluation.

## Project Overview
This project implements a scalable notification platform capable of handling real-time updates for students. It features a robust REST API, persistent database storage, and an asynchronous notification dispatch system.

## Table of Contents
* [System Architecture](#system-architecture)
* [Design Documentation](#design-documentation)
* [Implementation Details](#implementation-details)
* [Logging Middleware](#logging-middleware)

## System Architecture
The system is designed to handle high-frequency requests by decoupling request processing from background tasks using a message-queue-based approach.

## Design Documentation
The complete technical design, including API contracts, database schema, and performance scaling strategies, is documented in the `notification_system_design.md` file.

## Implementation Details
* **Stage 1 & 2:** REST API design and relational database schema implementation.
* **Stage 3 & 4:** Query optimization and performance tuning strategies for high-volume data.
* **Stage 5:** Implementation of an asynchronous `notify_all` mechanism to ensure reliability during failures.
* **Stage 6:** Priority-based notification inbox using a custom weighting algorithm.
* **Stage 7:** Responsive frontend built with React/Next.js for real-time notification viewing.

## Logging Middleware
In accordance with assessment requirements, all services and API routes utilize the mandatory **Logging Middleware** for auditing and monitoring request/response cycles.
