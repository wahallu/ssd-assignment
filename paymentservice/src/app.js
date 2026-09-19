const env = require("./config/env");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const paymentRoutes = require("./routes/paymentRoutes");
const errorHandler = require("./middlewares/errorHandler");
const { internalAuth, sanitize, securityHeaders } = require("./middlewares/security");

const app = express();
const PORT = env.PORT || 6000;

app.disable("x-powered-by");

// --------------- Middleware ---------------
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// --------------- Health Check ---------------
app.get("/", (req, res) => {
    res.status(200).json({ success: true, service: "Payment Service", status: "running" });
});

// --------------- Routes (gateway-only + sanitised) ---------------
app.use("/api", internalAuth, sanitize);
app.use("/api/payments", paymentRoutes);

// --------------- Centralized Error Handler ---------------
app.use(errorHandler);

// --------------- Database Connection & Server Start ---------------
mongoose
    .connect(env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
        app.listen(PORT, () => {
            console.log(`🚀 Payment Service running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err.message);
        process.exit(1);
    });

module.exports = app;
