/**
 * Central environment loader — fail-fast on missing secrets.
 * INTERNAL_API_KEY is required so the service only trusts traffic from the gateway.
 */
require("dotenv").config();

const required = ["INTERNAL_API_KEY", "MONGODB_URI"];
const missing = required.filter((k) => !process.env[k] || process.env[k].trim() === "");

if (missing.length > 0) {
    console.error(
        `[FATAL] Missing required environment variables: ${missing.join(", ")}. See .env.example.`
    );
    process.exit(1);
}

module.exports = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT,
    MONGODB_URI: process.env.MONGODB_URI,
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
    EVENT_SERVICE_URL: process.env.EVENT_SERVICE_URL || "http://127.0.0.1:4000",
    TICKET_SERVICE_URL: process.env.TICKET_SERVICE_URL || "http://127.0.0.1:5000",
};
