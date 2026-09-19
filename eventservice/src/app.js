const env = require("./config/env");

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const eventRoutes = require("./routes/eventRoutes");
const errorHandler = require("./middlewares/errorHandler");
const { internalAuth, sanitize, securityHeaders } = require("./middlewares/security");

const app = express();

app.disable("x-powered-by");

// --------------- Middleware ---------------
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// --------------- Health Check ---------------
app.get("/", (req, res) => {
    res.status(200).json({ success: true, service: "Event Service", status: "running" });
});

// --------------- Routes (gateway-only + sanitised) ---------------
app.use("/api", internalAuth, sanitize);
app.use("/api/events", eventRoutes);

// --------------- Centralized Error Handler ---------------
app.use(errorHandler);

// --------------- Start Server ---------------
const PORT = env.PORT || 4000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Event Service running on port ${PORT}`);
    });
});
