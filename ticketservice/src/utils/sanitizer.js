/**
 * NoSQL injection sanitizer & object scrubber.
 * Strips MongoDB operator keys ($*), dotted keys (*.*), and prototype pollution vectors.
 */

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const scrub = (value) => {
    if (Array.isArray(value)) {
        return value.map(scrub);
    }
    if (value && typeof value === "object") {
        for (const key of Object.keys(value)) {
            if (key.startsWith("$") || key.includes(".") || FORBIDDEN_KEYS.has(key)) {
                delete value[key];
            } else {
                value[key] = scrub(value[key]);
            }
        }
    }
    return value;
};

const sanitize = (req, _res, next) => {
    if (req.body) scrub(req.body);
    if (req.params) scrub(req.params);
    if (typeof next === "function") next();
};

module.exports = {
    scrub,
    sanitize,
};
