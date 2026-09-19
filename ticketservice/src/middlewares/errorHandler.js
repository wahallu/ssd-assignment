const errorHandler = (err, req, res, next) => {
    console.error(`❌ Error: ${err.message}`);

    // Mongoose validation error
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((val) => val.message);
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: messages,
        });
    }

    // Mongoose bad ObjectId (CastError)
    if (err.name === "CastError" && err.kind === "ObjectId") {
        return res.status(400).json({
            success: false,
            message: `Invalid resource id: ${err.value}`,
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        return res.status(400).json({
            success: false,
            message: "Duplicate field value entered",
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
