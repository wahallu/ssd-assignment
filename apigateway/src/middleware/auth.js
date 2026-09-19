const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");

/**
 * JWT authentication middleware for the API Gateway.
 *
 * Verifies the Bearer token with the mandatory JWT_SECRET (no insecure default)
 * and attaches the decoded payload to req.user. The gateway is the ONLY place a
 * JWT is verified; backend services trust the identity headers the gateway adds.
 */
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Not authorized, no token provided",
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Not authorized, token is invalid",
        });
    }
};

module.exports = { authenticate };
