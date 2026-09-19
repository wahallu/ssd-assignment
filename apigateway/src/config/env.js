/**
 * Central environment loader for the API Gateway.
 *
 * Fixes the "hard-coded / default secret" vulnerability: instead of falling
 * back to a well-known value like "eventhub", the process refuses to start if
 * a required secret is missing. This turns a silent security hole into a loud,
 * fail-fast configuration error.
 */
require("dotenv").config();

const required = ["JWT_SECRET", "INTERNAL_API_KEY"];
const missing = required.filter((k) => !process.env[k] || process.env[k].trim() === "");

if (missing.length > 0) {
    console.error(
        `[FATAL] Missing required environment variables: ${missing.join(", ")}.\n` +
        `Refusing to start with insecure defaults. See .env.example.`
    );
    process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
    console.error("[FATAL] JWT_SECRET must be at least 32 characters of high-entropy data.");
    process.exit(1);
}

module.exports = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 7000,
    JWT_SECRET: process.env.JWT_SECRET,
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
    CORS_ORIGINS: (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    USER_SERVICE_URL: process.env.USER_SERVICE_URL || "http://127.0.0.1:3000",
    EVENT_SERVICE_URL: process.env.EVENT_SERVICE_URL || "http://127.0.0.1:4000",
    TICKET_SERVICE_URL: process.env.TICKET_SERVICE_URL || "http://127.0.0.1:5000",
    PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || "http://127.0.0.1:6000",
};
