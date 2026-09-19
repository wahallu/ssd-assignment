const rateLimit = require("express-rate-limit");

/**
 * Global limiter — 100 requests per 15 minutes per IP.
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests, please try again later",
    },
});

/**
 * Strict limiter for authentication endpoints to blunt credential brute-forcing:
 * 5 attempts per 15 minutes per IP. Successful requests are not counted.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts, please try again in 15 minutes",
    },
});

module.exports = { globalLimiter, authLimiter };
