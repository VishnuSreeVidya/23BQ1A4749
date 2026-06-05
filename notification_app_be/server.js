import express from 'express';
import cors from 'cors';
import { requestLogger } from './src/middleware/logging.js';
import notificationsRouter from './src/routes/notifications.js';
import cache from './src/services/cache.js';
import queue from './src/services/queue.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use('/api/v1/notifications', notificationsRouter);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
    await cache.connect(process.env.REDIS_URL || 'redis://localhost:6379');
    await queue.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');

    app.listen(PORT, () => {
        console.log(`Notification API running on port ${PORT}`);
    });
}

start();
