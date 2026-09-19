/**
 * Central environment loader for the User Service — fail-fast on missing secrets.
 * Removes the insecure `process.env.JWT_SECRET || "eventhub"` style fallbacks.
 */
require("dotenv").config();

const required = ["JWT_SECRET", "INTERNAL_API_KEY", "MONGODB_URI"];
const missing = required.filter((k) => !process.env[k] || process.env[k].trim() === "");

if (missing.length > 0) {
    console.error(
        `[FATAL] Missing required environment variables: ${missing.join(", ")}. See .env.example.`
    );
    process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
    console.error("[FATAL] JWT_SECRET must be at least 32 characters of high-entropy data.");
    process.exit(1);
}

module.exports = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || 3000,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
    INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || "",
    ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || "",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",
    OAUTH_SUCCESS_REDIRECT: process.env.OAUTH_SUCCESS_REDIRECT || "",
};
