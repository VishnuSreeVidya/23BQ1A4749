import LoggingMiddleware from '../../../logging_middleware/index.js';

const loggingMiddleware = new LoggingMiddleware({
    sensitiveHeaders: ['authorization', 'cookie', 'x-api-key'],
});

export function requestLogger(req, res, next) {
    return loggingMiddleware.expressMiddleware(req, res, next);
}

export function wrapWithLogging(fn, context = {}) {
    return loggingMiddleware.wrap(fn, context);
}

export default loggingMiddleware;
