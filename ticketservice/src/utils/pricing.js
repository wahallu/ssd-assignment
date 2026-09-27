/**
 * Authoritative ticket pricing and input validation helpers.
 * Ensures business logic integrity: price is calculated strictly server-side,
 * never trusted from client payloads.
 */

const MAX_SEATS_PER_BOOKING = 50;

const calculateTicketPrice = (eventPrice, seatCount) => {
    const unitPrice = Number(eventPrice);
    if (isNaN(unitPrice) || unitPrice < 0) {
        throw new Error("Invalid event price");
    }
    const count = Number(seatCount);
    if (!Number.isInteger(count) || count < 1) {
        throw new Error("seatCount must be an integer >= 1");
    }
    return Number((unitPrice * count).toFixed(2));
};

const validateTicketInput = ({ eventId, seatCount }) => {
    if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
        return { valid: false, message: "Missing required fields: eventId, seatCount" };
    }
    if (!/^[0-9a-fA-F]{24}$/.test(eventId.trim())) {
        return { valid: false, message: "Invalid eventId format (expected 24-character hex ObjectId)" };
    }
    if (!Number.isInteger(seatCount) || seatCount < 1) {
        return { valid: false, message: "seatCount must be an integer >= 1" };
    }
    if (seatCount > MAX_SEATS_PER_BOOKING) {
        return { valid: false, message: `seatCount cannot exceed ${MAX_SEATS_PER_BOOKING}` };
    }
    return { valid: true };
};

module.exports = {
    calculateTicketPrice,
    validateTicketInput,
    MAX_SEATS_PER_BOOKING,
};
