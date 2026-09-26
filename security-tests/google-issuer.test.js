const assert = require("node:assert/strict");
const test = require("node:test");

const { isGoogleIssuer } = require("../userservice/src/utils/googleIssuer");

test("accepts Google's documented issuer values", () => {
    assert.equal(isGoogleIssuer("https://accounts.google.com"), true);
    assert.equal(isGoogleIssuer("accounts.google.com"), true);
});

test("rejects other and missing issuer values", () => {
    assert.equal(isGoogleIssuer("https://attacker.example"), false);
    assert.equal(isGoogleIssuer(""), false);
    assert.equal(isGoogleIssuer(undefined), false);
});