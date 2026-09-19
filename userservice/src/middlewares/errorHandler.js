const errorHandler = (err, req, res, next) => {
    console.error("Error:", err.message);

    // Mongoose validation error
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: messages.join(", "),
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue).join(", ");
        return res.status(409).json({
            success: false,
            message: `Duplicate value for field: ${field}`,
        });
    }

    // Mongoose bad ObjectId
    if (err.name === "CastError" && err.kind === "ObjectId") {
        return res.status(400).json({
            success: false,
            message: "Invalid ID format",
        });
    }

    // Default server error — never leak internal error details to clients.
    const statusCode = err.statusCode || 500;
    const clientError = statusCode >= 400 && statusCode < 500;
    res.status(statusCode).json({
        success: false,
        message: clientError && err.message ? err.message : "Internal Server Error",
    });
};

module.exports = errorHandler;
