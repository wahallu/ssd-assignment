const env = require("./config/env");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const { authenticate } = require("./middleware/auth");
const { globalLimiter, authLimiter, writeLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = env.PORT;

// Do not advertise the framework.
app.disable("x-powered-by");

// Trust proxy — required when running behind a reverse proxy (Azure Container Apps, etc.)
app.set("trust proxy", 1);

// ─── Service URLs ───────────────────────────────────────────────
const {
    USER_SERVICE_URL,
    EVENT_SERVICE_URL,
    TICKET_SERVICE_URL,
    PAYMENT_SERVICE_URL,
    INTERNAL_API_KEY,
    CORS_ORIGINS,
} = env;

// ─── Security headers (dependency-free helmet subset) ───────────
app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
});

// ─── CORS allow-list ────────────────────────────────────────────
// Only the configured browser origins may call the API with credentials.
app.use(
    cors({
        origin: (origin, cb) => {
            // Allow same-origin / server-to-server requests (no Origin header).
            if (!origin) return cb(null, true);
            if (CORS_ORIGINS.includes(origin)) return cb(null, true);
            return cb(new Error("Origin not allowed by CORS"));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
);

app.use(morgan("dev"));
app.use(globalLimiter);

// ─── Strip any client-supplied trust headers ────────────────────
// Prevents a caller from forging identity/role or the internal key directly.
app.use((req, _res, next) => {
    delete req.headers["x-internal-key"];
    delete req.headers["x-user-id"];
    delete req.headers["x-user-role"];
    delete req.headers["x-user-email"];
    next();
});

// ─── Health Check ───────────────────────────────────────────────
app.get("/", (req, res) => {
    res.status(200).json({ success: true, service: "API Gateway", status: "running" });
});

// ─── Public paths that skip authentication ──────────────────────
const PUBLIC_PATHS = [
    "/api/users/register",
    "/api/users/login",
    "/api/users/auth/google", // OAuth start + callback
];

const isPublic = (req) => PUBLIC_PATHS.some((p) => req.originalUrl.startsWith(p));

// Public GET access to browse events; everything else on /api/events is protected.
const isPublicEventRead = (req) =>
    req.method === "GET" && req.originalUrl.startsWith("/api/events");

/** Apply JWT auth unless the route is explicitly public. */
const conditionalAuth = (req, res, next) => {
    if (isPublic(req) || isPublicEventRead(req)) return next();
    return authenticate(req, res, next);
};

/**
 * Inject the shared internal key on every proxied request, plus the verified
 * identity for authenticated requests. Backend services reject anything without
 * a valid internal key, so the gateway becomes the sole trusted entry point.
 */
const injectTrust = (req, _res, next) => {
    req.headers["x-internal-key"] = INTERNAL_API_KEY;
    if (req.user) {
        req.headers["x-user-id"] = String(req.user.id || "");
        req.headers["x-user-role"] = String(req.user.role || "");
        req.headers["x-user-email"] = String(req.user.email || "");
    }
    next();
};

// ─── Auth wiring ────────────────────────────────────────────────
app.use("/api/users/login", authLimiter);
app.use("/api/users/register", authLimiter);

// Extra budget on top of globalLimiter for the sensitive write paths that
// reserve seats and move money — blunts booking/payment spam and scalping
// bots beyond what the generic per-IP limit covers.
const limitWrites = (req, res, next) =>
    req.method === "POST" ? writeLimiter(req, res, next) : next();
app.use("/api/tickets", limitWrites);
app.use("/api/payments", limitWrites);

app.use("/api/users", conditionalAuth);
app.use("/api/events", conditionalAuth);
app.use("/api/tickets", authenticate);
app.use("/api/payments", authenticate);

// Attach trust headers after auth has (optionally) populated req.user.
app.use(injectTrust);

// ─── Proxy Factory ──────────────────────────────────────────────
const createServiceProxy = (pathPrefix, target) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathFilter: pathPrefix,
        on: {
            // Forward the headers we set in Express onto the proxied request.
            proxyReq: (proxyReq, req) => {
                ["x-internal-key", "x-user-id", "x-user-role", "x-user-email"].forEach((h) => {
                    if (req.headers[h] !== undefined) proxyReq.setHeader(h, req.headers[h]);
                });
            },
            error: (err, req, res) => {
                console.error(`Proxy error [${pathPrefix}]: ${err.message}`);
                res.status(502).json({ success: false, message: "Service unavailable" });
            },
        },
    });

// ─── Route Proxies ──────────────────────────────────────────────
app.use(createServiceProxy("/api/users", USER_SERVICE_URL));
app.use(createServiceProxy("/api/events", EVENT_SERVICE_URL));
app.use(createServiceProxy("/api/tickets", TICKET_SERVICE_URL));
app.use(createServiceProxy("/api/payments", PAYMENT_SERVICE_URL));

// ─── Centralized Error Handling ─────────────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on port ${PORT}`);
});

module.exports = app;
