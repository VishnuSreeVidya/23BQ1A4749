class LoggingMiddleware {
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.sensitiveHeaders = new Set(
            (options.sensitiveHeaders || ['authorization', 'cookie', 'x-api-key'])
                .map(h => h.toLowerCase())
        );
    }

    formatTimestamp(date) {
        return date.toISOString().replace('T', ' ').slice(0, 23);
    }

    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        for (const key of Object.keys(sanitized)) {
            if (this.sensitiveHeaders.has(key.toLowerCase())) {
                sanitized[key] = '***';
            }
        }
        return sanitized;
    }

    wrap(fn, context = {}) {
        const self = this;
        return async function (...args) {
            const start = performance.now();
            const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);

            self.logger.log(
                `[${self.formatTimestamp(new Date())}] [${requestId}] ENTER ${context.method || 'CALL'} ${context.url || fn.name || 'anonymous'}`
            );

            try {
                const result = await fn.apply(this, args);
                const duration = (performance.now() - start).toFixed(2);

                self.logger.log(
                    `[${self.formatTimestamp(new Date())}] [${requestId}] EXIT  ${context.method || 'CALL'} ${context.url || fn.name || 'anonymous'} — ${duration}ms ✓`
                );
                return result;
            } catch (error) {
                const duration = (performance.now() - start).toFixed(2);

                self.logger.error(
                    `[${self.formatTimestamp(new Date())}] [${requestId}] ERROR ${context.method || 'CALL'} ${context.url || fn.name || 'anonymous'} — ${duration}ms ✗ ${error.message}`
                );
                throw error;
            }
        };
    }

    expressMiddleware(req, res, next) {
        const start = performance.now();
        const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);
        const entry = {
            requestId,
            method: req.method,
            url: req.originalUrl || req.url,
            headers: this.sanitizeHeaders(req.headers),
            query: req.query,
            timestamp: this.formatTimestamp(new Date()),
        };

        if (req.body && Object.keys(req.body).length) {
            entry.body = req.body;
        }

        this.logger.log(`[${entry.timestamp}] [${requestId}] → ${req.method} ${entry.url}`);

        const originalEnd = res.end;
        res.end = (...args) => {
            const duration = (performance.now() - start).toFixed(2);
            const status = res.statusCode;

            const icon = status >= 400 ? '✗' : '✓';
            this.logger.log(
                `[${this.formatTimestamp(new Date())}] [${requestId}] ${icon} ${req.method} ${entry.url} → ${status} — ${duration}ms`
            );

            if (status >= 500) {
                this.logger.error(
                    `[${this.formatTimestamp(new Date())}] [${requestId}] SERVER_ERROR ${req.method} ${entry.url} → ${status} — ${duration}ms`,
                    { requestId, method: req.method, url: entry.url, status, duration }
                );
            }

            return originalEnd.apply(res, args);
        };

        next();
    }
}

export default LoggingMiddleware;
