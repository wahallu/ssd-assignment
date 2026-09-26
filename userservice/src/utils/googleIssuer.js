const GOOGLE_ISSUERS = new Set([
    "https://accounts.google.com",
    "accounts.google.com",
]);

const isGoogleIssuer = (issuer) => GOOGLE_ISSUERS.has(issuer);

module.exports = { isGoogleIssuer };
