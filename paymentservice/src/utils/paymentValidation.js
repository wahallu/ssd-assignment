/**
 * Authoritative payment validation helpers.
 * Ensures business logic integrity:
 * - Payment amount is strictly derived from the verified ticket price
 * - Payment methods are restricted to an allow-list
 * - Ticket ownership is verified before processing payment
 */

const VALID_PAYMENT_METHODS = new Set(["card", "cash", "online"]);

const validatePaymentInput = ({ ticketId, paymentMethod }) => {
    if (!ticketId || !paymentMethod) {
        return {
            valid: false,
            message: "Missing required fields: ticketId, paymentMethod",
        };
    }
    if (!/^[0-9a-fA-F]{24}$/.test(String(ticketId).trim())) {
        return {
            valid: false,
            message: "Invalid ticketId format (expected 24-character hex ObjectId)",
        };
    }
    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
        return {
            valid: false,
            message: `paymentMethod must be one of: ${Array.from(VALID_PAYMENT_METHODS).join(", ")}`,
        };
    }
    return { valid: true };
};

const verifyPaymentEligibility = (ticket, userId, role) => {
    if (!ticket) {
        return { eligible: false, statusCode: 404, message: "Ticket not found" };
    }
    if (role !== "admin" && String(ticket.userId) !== String(userId)) {
        return { eligible: false, statusCode: 403, message: "You can only pay for your own ticket" };
    }
    const amount = Number(ticket.price);
    if (isNaN(amount) || amount <= 0) {
        return { eligible: false, statusCode: 400, message: "Invalid ticket amount for payment" };
    }
    return { eligible: true, amount };
};

module.exports = {
    validatePaymentInput,
    verifyPaymentEligibility,
    VALID_PAYMENT_METHODS,
};
