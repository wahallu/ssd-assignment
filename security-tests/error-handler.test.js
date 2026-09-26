const assert = require("node:assert/strict");
const test = require("node:test");

const errorHandlers = [
    ["API gateway", require("../apigateway/src/middleware/errorHandler")],
    ["user service", require("../userservice/src/middlewares/errorHandler")],
    ["event service", require("../eventservice/src/middlewares/errorHandler")],
    ["ticket service", require("../ticketservice/src/middlewares/errorHandler")],
    ["payment service", require("../paymentservice/src/middlewares/errorHandler")],
];

test("service error handlers log internal details but return a generic 500", () => {
    const originalConsoleError = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(" "));

    try {
        for (const [service, errorHandler] of errorHandlers) {
            const response = {
                statusCode: null,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(body) {
                    this.body = body;
                    return this;
                },
            };
            const internalError = new Error(
                "MongoServerError: connection refused at db.internal:27017"
            );

            errorHandler(internalError, {}, response, () => {});

            assert.equal(response.statusCode, 500, `${service} status`);
            assert.deepEqual(
                response.body,
                { success: false, message: "Internal Server Error" },
                `${service} response`
            );
        }
    } finally {
        console.error = originalConsoleError;
    }

    assert.equal(logged.length, errorHandlers.length);
    assert.ok(logged.every((entry) => entry.includes("MongoServerError")));
});
