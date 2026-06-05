type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    requestId: string;
    method?: string;
    url?: string;
    status?: number;
    durationMs?: number;
    message: string;
    metadata?: Record<string, unknown>;
}

const SENSITIVE_HEADERS = new Set([
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
]);

function formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 23);
}

function generateRequestId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 10);
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        sanitized[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '***' : value;
    }
    return sanitized;
}

class Logger {
    private log(level: LogLevel, entry: Omit<LogEntry, 'timestamp' | 'level' | 'requestId'> & { requestId?: string }) {
        const logEntry: LogEntry = {
            timestamp: formatTimestamp(new Date()),
            level,
            requestId: entry.requestId || generateRequestId(),
            message: entry.message,
            ...entry,
        };

        const formatted = `[${logEntry.timestamp}] [${logEntry.requestId}] ${logEntry.level.toUpperCase()} ${logEntry.message}`;

        switch (level) {
            case 'error':
                console.error(formatted, logEntry.metadata || '');
                break;
            case 'warn':
                console.warn(formatted, logEntry.metadata || '');
                break;
            case 'debug':
                console.debug(formatted, logEntry.metadata || '');
                break;
            default:
                console.log(formatted, logEntry.metadata || '');
        }
    }

    info(message: string, metadata?: Record<string, unknown>): void {
        this.log('info', { message, metadata });
    }

    warn(message: string, metadata?: Record<string, unknown>): void {
        this.log('warn', { message, metadata });
    }

    error(message: string, metadata?: Record<string, unknown>): void {
        this.log('error', { message, metadata });
    }

    debug(message: string, metadata?: Record<string, unknown>): void {
        this.log('debug', { message, metadata });
    }

    wrap<T>(fn: (...args: unknown[]) => Promise<T>, context: { method?: string; url?: string } = {}): (...args: unknown[]) => Promise<T> {
        return async (...args: unknown[]): Promise<T> => {
            const requestId = generateRequestId();
            const start = performance.now();

            this.info(`ENTER ${context.method || 'CALL'} ${context.url || fn.name || 'anonymous'}`, { requestId });

            try {
                const result = await fn(...args);
                const duration = +(performance.now() - start).toFixed(2);

                this.info(`EXIT ${context.method || 'CALL'} ${context.url || fn.name || 'anonymous'} — ${duration}ms`, {
                    requestId,
                    durationMs: duration,
                });

                return result;
            } catch (error) {
                const duration = +(performance.now() - start).toFixed(2);
                const message = error instanceof Error ? error.message : String(error);

                this.error(`ERROR ${context.method || 'CALL'} ${context.url || fn.name || 'anonymous'} — ${duration}ms ${message}`, {
                    requestId,
                    durationMs: duration,
                    error: message,
                });

                throw error;
            }
        };
    }

    expressMiddleware(req: any, res: any, next: () => void): void {
        const requestId = generateRequestId();
        const start = performance.now();

        this.info(`→ ${req.method} ${req.originalUrl || req.url}`, {
            requestId,
            method: req.method,
            url: req.originalUrl || req.url,
            headers: sanitizeHeaders(req.headers || {}),
        });

        const originalEnd = res.end;
        res.end = (...args: unknown[]) => {
            const duration = +(performance.now() - start).toFixed(2);
            const status = res.statusCode;

            const level = status >= 500 ? 'error' : 'info';
            const icon = status >= 400 ? '✗' : '✓';

            this[level](`${icon} ${req.method} ${req.originalUrl || req.url} → ${status} — ${duration}ms`, {
                requestId,
                method: req.method,
                url: req.originalUrl || req.url,
                status,
                durationMs: duration,
            });

            return originalEnd.apply(res, args);
        };

        next();
    }
}

export default Logger;
