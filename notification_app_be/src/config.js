const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    },
    database: {
        url: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/notifications',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'dev_secret',
    },
};

export default config;
