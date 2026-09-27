const assert = require("node:assert/strict");
const test = require("node:test");
const {
    calculateTicketPrice,
    validateTicketInput,
    MAX_SEATS_PER_BOOKING,
} = require("../ticketservice/src/utils/pricing");

test("calculateTicketPrice computes authoritative price with correct precision", () => {
    assert.equal(calculateTicketPrice(25, 1), 25);
    assert.equal(calculateTicketPrice(25, 4), 100);
    assert.equal(calculateTicketPrice(33.333, 3), 100);
    assert.equal(calculateTicketPrice(12.5, 2), 25);
});

test("calculateTicketPrice rejects invalid seat counts or prices", () => {
    assert.throws(() => calculateTicketPrice(25, 0), /seatCount must be an integer/);
    assert.throws(() => calculateTicketPrice(25, -1), /seatCount must be an integer/);
    assert.throws(() => calculateTicketPrice(25, 2.5), /seatCount must be an integer/);
    assert.throws(() => calculateTicketPrice(-10, 1), /Invalid event price/);
    assert.throws(() => calculateTicketPrice("abc", 1), /Invalid event price/);
});

test("validateTicketInput enforces valid ObjectId and positive seat counts", () => {
    const validId = "660c1f5b2f8a9e001a2b3c4d";
    
    assert.deepEqual(validateTicketInput({ eventId: validId, seatCount: 2 }), { valid: true });

    // Missing eventId
    assert.equal(validateTicketInput({ eventId: "", seatCount: 1 }).valid, false);

    // Invalid hex length
    assert.equal(validateTicketInput({ eventId: "12345", seatCount: 1 }).valid, false);

    // Non-integer seatCount
    assert.equal(validateTicketInput({ eventId: validId, seatCount: 1.5 }).valid, false);

    // Negative seatCount
    assert.equal(validateTicketInput({ eventId: validId, seatCount: -2 }).valid, false);

    // Exceeding MAX_SEATS_PER_BOOKING
    assert.equal(
        validateTicketInput({ eventId: validId, seatCount: MAX_SEATS_PER_BOOKING + 1 }).valid,
        false
    );
});
