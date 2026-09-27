const assert = require("node:assert/strict");
const test = require("node:test");
const { sanitize, scrub } = require("../ticketservice/src/utils/sanitizer");

test("NoSQL sanitizer strips operator keys ($) from request body", () => {
    const req = {
        body: {
            username: "alice",
            $ne: "admin",
            nested: {
                valid: "ok",
                $gt: 0,
            },
        },
        params: {},
    };

    sanitize(req, {}, () => {});

    assert.equal(req.body.username, "alice");
    assert.equal(req.body.$ne, undefined);
    assert.equal(req.body.nested.valid, "ok");
    assert.equal(req.body.nested.$gt, undefined);
});

test("NoSQL sanitizer strips dotted keys from request body and params", () => {
    const req = {
        body: {
            "profile.role": "admin",
            safeField: "value",
        },
        params: {
            "id.secret": "12345",
            id: "660c1f5b2f8a9e001a2b3c4d",
        },
    };

    sanitize(req, {}, () => {});

    assert.equal(req.body["profile.role"], undefined);
    assert.equal(req.body.safeField, "value");
    assert.equal(req.params["id.secret"], undefined);
    assert.equal(req.params.id, "660c1f5b2f8a9e001a2b3c4d");
});

test("NoSQL sanitizer recursively scrubs objects inside arrays", () => {
    const req = {
        body: {
            items: [
                { id: "1", $where: "sleep(5000)" },
                { id: "2", valid: true },
            ],
        },
    };

    sanitize(req, {}, () => {});

    assert.equal(req.body.items[0].id, "1");
    assert.equal(req.body.items[0].$where, undefined);
    assert.equal(req.body.items[1].valid, true);
});

test("NoSQL sanitizer safely handles primitives and null values", () => {
    const req = {
        body: {
            empty: null,
            count: 0,
            flag: false,
            text: "normal string",
        },
    };

    sanitize(req, {}, () => {});

    assert.equal(req.body.empty, null);
    assert.equal(req.body.count, 0);
    assert.equal(req.body.flag, false);
    assert.equal(req.body.text, "normal string");
});

test("NoSQL sanitizer strips prototype pollution vectors", () => {
    const maliciousPayload = {
        safe: 1,
        nested: {
            valid: true,
            constructor: "bad",
            prototype: "bad",
        },
    };
    scrub(maliciousPayload);

    assert.equal(maliciousPayload.safe, 1);
    assert.equal(maliciousPayload.nested.valid, true);
    assert.equal(Object.prototype.hasOwnProperty.call(maliciousPayload.nested, "constructor"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(maliciousPayload.nested, "prototype"), false);
});
