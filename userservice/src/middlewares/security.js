/**
 * Shared security middleware for a backend microservice.
 *
 * Addresses several findings at once:
 *  - Broken access control: identity/role are taken from headers that ONLY the
 *    API Gateway is allowed to set (enforced by a shared INTERNAL_API_KEY that
 *    is never exposed to browsers), plus requireAuth / requireAdmin guards.
 *  - Security misconfiguration: sensible security headers, no X-Powered-By.
 *  - NoSQL injection: recursively strips Mongo operators ($, .) from user input.
 */
const crypto = require("crypto");
const { INTERNAL_API_KEY } = require("../config/env");

/** Constant-time string compare that never throws on length mismatch. */
const safeEqual = (a, b) => {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
};

/**
 * Reject any request that did not come through the API Gateway.
 * The gateway forwards the shared internal key and the authenticated identity.
 */
const internalAuth = (req, res, next) => {
    const key = req.headers["x-internal-key"];
    if (!key || !safeEqual(key, INTERNAL_API_KEY)) {
        return res.status(403).json({
            success: false,
            message: "Forbidden: direct access to internal service is not allowed",
        });
    }
    // Identity is trusted only because it arrived with a valid internal key.
    req.auth = {
        userId: req.headers["x-user-id"] || null,
        role: req.headers["x-user-role"] || null,
        email: req.headers["x-user-email"] || null,
    };
    next();
};

/** Require an authenticated end user (gateway verified the JWT). */
const requireAuth = (req, res, next) => {
    if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
    next();
};

/** Require the authenticated user to have the admin role. */
const requireAdmin = (req, res, next) => {
    if (!req.auth || req.auth.role !== "admin") {
        return res.status(403).json({ success: false, message: "Admin privileges required" });
    }
    next();
};

/** Recursively remove keys that could be interpreted as Mongo query operators. */
const scrub = (value) => {
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === "object") {
        for (const key of Object.keys(value)) {
            if (key.startsWith("$") || key.includes(".")) {
                delete value[key];
            } else {
                value[key] = scrub(value[key]);
            }
        }
    }
    return value;
};

/**
 * Sanitise request input against NoSQL operator injection.
 * req.query is read-only in Express 5, so its values are validated per-controller;
 * here we scrub body and params in place.
 */
const sanitize = (req, _res, next) => {
    if (req.body) scrub(req.body);
    if (req.params) scrub(req.params);
    next();
};

/** Minimal, dependency-free security headers (helmet-equivalent subset). */
const securityHeaders = (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
    );
    res.removeHeader("X-Powered-By");
    next();
};

module.exports = {
    internalAuth,
    requireAuth,
    requireAdmin,
    sanitize,
    securityHeaders,
    safeEqual,
};
