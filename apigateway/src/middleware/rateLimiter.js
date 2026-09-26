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

/**
 * Stricter limiter for ticket/payment creation — these are the sensitive
 * write paths tied to seat reservation and money movement, so they get a
 * tighter budget than ordinary browsing traffic to blunt booking/payment
 * spam and scalping bots. Failed attempts still count, since the goal is
 * to cap total write volume, not just successful bookings.
 */
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many booking/payment attempts, please try again later",
    },
});

module.exports = { globalLimiter, authLimiter, writeLimiter };
