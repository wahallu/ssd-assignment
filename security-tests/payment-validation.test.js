const assert = require("node:assert/strict");
const test = require("node:test");
const {
    validatePaymentInput,
    verifyPaymentEligibility,
} = require("../paymentservice/src/utils/paymentValidation");

test("validatePaymentInput accepts allowed payment methods and valid ticket IDs", () => {
    const validId = "660c1f5b2f8a9e001a2b3c4d";
    assert.deepEqual(validatePaymentInput({ ticketId: validId, paymentMethod: "card" }), { valid: true });
    assert.deepEqual(validatePaymentInput({ ticketId: validId, paymentMethod: "cash" }), { valid: true });
    assert.deepEqual(validatePaymentInput({ ticketId: validId, paymentMethod: "online" }), { valid: true });
});

test("validatePaymentInput rejects invalid methods, malformed IDs, or missing fields", () => {
    const validId = "660c1f5b2f8a9e001a2b3c4d";

    // Invalid method
    assert.equal(validatePaymentInput({ ticketId: validId, paymentMethod: "bitcoin" }).valid, false);

    // Malformed ID
    assert.equal(validatePaymentInput({ ticketId: "invalid-id", paymentMethod: "card" }).valid, false);

    // Missing field
    assert.equal(validatePaymentInput({ ticketId: validId, paymentMethod: "" }).valid, false);
});

test("verifyPaymentEligibility enforces ticket ownership and positive amount", () => {
    const aliceId = "alice123";
    const bobId = "bob456";

    const aliceTicket = {
        _id: "ticket1",
        userId: aliceId,
        price: 50.0,
    };

    // Owner paying for own ticket
    const ownerCheck = verifyPaymentEligibility(aliceTicket, aliceId, "customer");
    assert.equal(ownerCheck.eligible, true);
    assert.equal(ownerCheck.amount, 50.0);

    // Cross-user payment attempt (Bob trying to pay Alice's ticket)
    const crossCheck = verifyPaymentEligibility(aliceTicket, bobId, "customer");
    assert.equal(crossCheck.eligible, false);
    assert.equal(crossCheck.statusCode, 403);

    // Admin can pay for any ticket
    const adminCheck = verifyPaymentEligibility(aliceTicket, bobId, "admin");
    assert.equal(adminCheck.eligible, true);

    // Zero or invalid price ticket rejected
    const zeroTicket = { _id: "ticket2", userId: aliceId, price: 0 };
    const zeroCheck = verifyPaymentEligibility(zeroTicket, aliceId, "customer");
    assert.equal(zeroCheck.eligible, false);
    assert.equal(zeroCheck.statusCode, 400);
});
