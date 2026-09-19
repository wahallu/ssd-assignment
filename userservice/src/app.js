const env = require("./config/env");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const userRoutes = require("./routes/userRoutes");
const oauthRoutes = require("./routes/oauthRoutes");
const errorHandler = require("./middlewares/errorHandler");
const {
    internalAuth,
    sanitize,
    securityHeaders,
} = require("./middlewares/security");

const app = express();
const PORT = env.PORT;

app.disable("x-powered-by");

// Middleware
app.use(securityHeaders);
app.use(cors()); // Browser traffic terminates at the gateway; keep CORS minimal here.
app.use(express.json({ limit: "100kb" }));

// Health check (no internal key required so orchestrators can probe it).
app.get("/", (req, res) => {
    res.status(200).json({ success: true, message: "User Service is running" });
});

// Every /api route must arrive through the gateway (valid internal key) and is sanitised.
app.use("/api", internalAuth, sanitize);

// Routes
app.use("/api/users/auth", oauthRoutes);
app.use("/api/users", userRoutes);

// Centralized error handling
app.use(errorHandler);

/**
 * Create the first admin account once, if configured and none exists yet.
 * This replaces the insecure "register with role=admin" path.
 */
const bootstrapAdmin = async () => {
    if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) return;
    const existing = await User.findOne({ role: "admin" });
    if (existing) return;
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(env.ADMIN_BOOTSTRAP_PASSWORD, salt);
    await User.create({
        name: "Administrator",
        email: env.ADMIN_BOOTSTRAP_EMAIL,
        password: hashed,
        role: "admin",
    });
    console.log(`Bootstrapped admin account: ${env.ADMIN_BOOTSTRAP_EMAIL}`);
};

// Database connection and server start
mongoose
    .connect(env.MONGODB_URI)
    .then(async () => {
        console.log("MongoDB connected successfully");
        await bootstrapAdmin();
        app.listen(PORT, () => {
            console.log(`User Service running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err.message);
        process.exit(1);
    });

module.exports = app;
