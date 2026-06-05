class QueueService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.connected = false;
    }

    async connect(url) {
        try {
            const amqp = await import('amqplib');
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            await this.channel.assertQueue('notification_broadcast', { durable: true });
            this.connected = true;
            console.log('RabbitMQ connected');
        } catch {
            console.warn('RabbitMQ unavailable — running without queue');
            this.connected = false;
        }
    }

    async publish(routingKey, message) {
        if (!this.connected) return;
        try {
            this.channel.sendToQueue(
                routingKey,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );
        } catch {
            // silently fail
        }
    }

    async consume(queue, handler) {
        if (!this.connected) return;
        try {
            await this.channel.consume(queue, async (msg) => {
                if (!msg) return;
                try {
                    const data = JSON.parse(msg.content.toString());
                    await handler(data);
                    this.channel.ack(msg);
                } catch (err) {
                    console.error('Queue handler error:', err.message);
                    this.channel.nack(msg, false, true);
                }
            });
        } catch {
            // silently fail
        }
    }

    async disconnect() {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
    }
}

export default new QueueService();
