/**
 * Centralized error handler for the API Gateway.
 * Never leaks internal error details / stack traces to clients in production.
 */
const errorHandler = (err, req, res, _next) => {
    console.error(`[Gateway Error] ${err.stack || err.message}`);

    const statusCode = err.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    res.status(statusCode).json({
        success: false,
        message: isClientError && err.message ? err.message : "Internal Server Error",
    });
};

module.exports = errorHandler;
