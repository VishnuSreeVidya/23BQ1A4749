class CacheService {
    constructor() {
        this.client = null;
        this.connected = false;
    }

    async connect(url) {
        try {
            const { createClient } = await import('redis');
            this.client = createClient({ url });
            this.client.on('error', (err) => console.error('Redis error:', err.message));
            await this.client.connect();
            this.connected = true;
            console.log('Redis connected');
        } catch {
            console.warn('Redis unavailable — running without cache');
            this.connected = false;
        }
    }

    async get(key) {
        if (!this.connected) return null;
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    async set(key, value, ttlSeconds = 300) {
        if (!this.connected) return;
        try {
            await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
        } catch {
            // silently fail
        }
    }

    async invalidatePattern(pattern) {
        if (!this.connected) return;
        try {
            let cursor = 0;
            do {
                const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = result.cursor;
                if (result.keys.length) {
                    await this.client.del(result.keys);
                }
            } while (cursor !== 0);
        } catch {
            // silently fail
        }
    }

    async disconnect() {
        if (this.client) await this.client.quit();
    }
}

export default new CacheService();
