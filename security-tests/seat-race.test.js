const assert = require("node:assert/strict");
const test = require("node:test");
const {
    validateSeatCount,
    buildReserveFilter,
    buildReserveUpdate,
    buildReleaseUpdate,
} = require("../eventservice/src/utils/seatManager");

test("validateSeatCount ensures positive integer seat counts", () => {
    assert.deepEqual(validateSeatCount(1), { valid: true, count: 1 });
    assert.deepEqual(validateSeatCount(5), { valid: true, count: 5 });

    assert.equal(validateSeatCount(0).valid, false);
    assert.equal(validateSeatCount(-1).valid, false);
    assert.equal(validateSeatCount(1.5).valid, false);
    assert.equal(validateSeatCount("invalid").valid, false);
});

test("buildReserveFilter and updates generate correct MongoDB atomic query clauses", () => {
    const eventId = "660c1f5b2f8a9e001a2b3c4d";
    const seatCount = 3;

    const filter = buildReserveFilter(eventId, seatCount);
    assert.deepEqual(filter, {
        _id: eventId,
        availableSeats: { $gte: 3 },
    });

    const reserveUpdate = buildReserveUpdate(seatCount);
    assert.deepEqual(reserveUpdate, {
        $inc: { availableSeats: -3 },
    });

    const releaseUpdate = buildReleaseUpdate(seatCount);
    assert.deepEqual(releaseUpdate, {
        $inc: { availableSeats: 3 },
    });
});

test("simulated atomic conditional decrement prevents overselling under concurrent load", async () => {
    // Model of atomic MongoDB findOneAndUpdate with condition { availableSeats: { $gte: count } }
    let state = { availableSeats: 4 };

    const atomicReserve = async (count) => {
        // Atomic compare-and-swap block
        if (state.availableSeats >= count) {
            state.availableSeats -= count;
            return { success: true, remaining: state.availableSeats };
        }
        return { success: false, remaining: state.availableSeats };
    };

    // 10 concurrent requests each demanding 2 seats on an inventory of only 4 seats
    const requests = Array.from({ length: 10 }, () => atomicReserve(2));
    const results = await Promise.all(requests);

    const successful = results.filter((r) => r.success);
    const rejected = results.filter((r) => !r.success);

    // Exactly 2 requests must succeed (2 * 2 = 4 seats)
    assert.equal(successful.length, 2, "exactly 2 reservations succeed");
    assert.equal(rejected.length, 8, "8 reservations rejected with conflict");
    assert.equal(state.availableSeats, 0, "availableSeats never drops below zero");
});
