/**
 * Seat management helper for atomic inventory reservations and releases.
 * Protects against race conditions (TOCTOU) and invalid capacity changes.
 */

const validateSeatCount = (seatCount) => {
    const count = Number(seatCount);
    if (!Number.isInteger(count) || count < 1) {
        return { valid: false, message: "seatCount must be a positive integer" };
    }
    return { valid: true, count };
};

const buildReserveFilter = (eventId, seatCount) => ({
    _id: eventId,
    availableSeats: { $gte: seatCount },
});

const buildReserveUpdate = (seatCount) => ({
    $inc: { availableSeats: -seatCount },
});

const buildReleaseUpdate = (seatCount) => ({
    $inc: { availableSeats: seatCount },
});

module.exports = {
    validateSeatCount,
    buildReserveFilter,
    buildReserveUpdate,
    buildReleaseUpdate,
};
