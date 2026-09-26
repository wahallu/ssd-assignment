/**
 * Sign in with Google — OpenID Connect Authorization Code flow with PKCE.
 *
 * New feature added on top of the security hardening: users can authenticate
 * with their Google account instead of a local password.
 *
 * Security properties implemented here:
 *  - Authorization Code flow (secret stays server-side; no tokens in the browser URL to Google)
 *  - PKCE (S256) to bind the code to this client
 *  - `state` parameter to defend against CSRF on the callback
 *  - `nonce` echoed in the ID token to defend against replay
 *  - ID token validated (signature + audience + issuer + expiry) via Google's
 *    tokeninfo endpoint, and the email must be verified by Google
 *
 * The short-lived flow parameters (state/nonce/code_verifier) are kept in a
 * signed, httpOnly cookie so no server-side session store is required.
 */
const crypto = require("crypto");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");
const { generateToken } = require("./userController");
const { isGoogleIssuer } = require("../utils/googleIssuer");

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";
const FLOW_COOKIE = "g_oauth_flow";

const isConfigured = () =>
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI;

const base64url = (buf) => buf.toString("base64url");

/** Sign a small JSON payload for the flow cookie (integrity-protected). */
const signFlow = (payload) =>
    jwt.sign(payload, env.JWT_SECRET, { expiresIn: "10m" });

const parseCookies = (header = "") =>
    header.split(";").reduce((acc, part) => {
        const idx = part.indexOf("=");
        if (idx > -1) acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
        return acc;
    }, {});

// Send the user back to the SPA with a friendly error instead of raw JSON,
// using the same URL-fragment technique as the success path so the reason
// never reaches server logs.
const failFlow = (res, status, message) => {
    if (env.OAUTH_SUCCESS_REDIRECT) {
        return res.redirect(`${env.OAUTH_SUCCESS_REDIRECT}#oauth_error=${encodeURIComponent(message)}`);
    }
    return res.status(status).json({ success: false, message });
};

// GET /api/users/auth/google — start the login flow
const googleStart = (req, res) => {
    if (!isConfigured()) {
        return res.status(503).json({
            success: false,
            message: "Google sign-in is not configured on this server",
        });
    }

    const state = base64url(crypto.randomBytes(24));
    const nonce = base64url(crypto.randomBytes(24));
    const codeVerifier = base64url(crypto.randomBytes(48));
    const codeChallenge = base64url(
        crypto.createHash("sha256").update(codeVerifier).digest()
    );

    // Store flow secrets in a signed, httpOnly cookie (10 min lifetime).
    const flow = signFlow({ state, nonce, codeVerifier });
    res.setHeader(
        "Set-Cookie",
        `${FLOW_COOKIE}=${flow}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${
            env.NODE_ENV === "production" ? "; Secure" : ""
        }`
    );

    const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        access_type: "online",
        prompt: "select_account",
    });

    res.redirect(`${GOOGLE_AUTH}?${params.toString()}`);
};

// GET /api/users/auth/google/callback — exchange the code and sign the user in
const googleCallback = async (req, res, next) => {
    try {
        if (!isConfigured()) {
            return res.status(503).json({ success: false, message: "Google sign-in is not configured" });
        }

        const { code, state } = req.query;
        const cookies = parseCookies(req.headers.cookie);
        const rawFlow = cookies[FLOW_COOKIE];

        if (!code || !state || !rawFlow) {
            return failFlow(res, 400, "Invalid OAuth callback");
        }

        // Verify + decode the flow cookie.
        let flow;
        try {
            flow = jwt.verify(rawFlow, env.JWT_SECRET);
        } catch {
            return failFlow(res, 400, "OAuth flow expired, please retry");
        }

        // CSRF defence: state must match what we issued.
        if (state !== flow.state) {
            return failFlow(res, 400, "OAuth state mismatch");
        }

        // Exchange the authorization code for tokens (with the PKCE verifier).
        const tokenRes = await axios.post(
            GOOGLE_TOKEN,
            new URLSearchParams({
                code: String(code),
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: env.GOOGLE_REDIRECT_URI,
                grant_type: "authorization_code",
                code_verifier: flow.codeVerifier,
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const idToken = tokenRes.data.id_token;
        if (!idToken) {
            return failFlow(res, 401, "No ID token returned by Google");
        }

        // Validate the ID token via Google's tokeninfo endpoint
        // (checks signature, expiry and returns the verified claims).
        const info = await axios.get(GOOGLE_TOKENINFO, { params: { id_token: idToken } });
        const claims = info.data;

        if (claims.aud !== env.GOOGLE_CLIENT_ID) {
            return failFlow(res, 401, "ID token audience mismatch");
        }
        if (!isGoogleIssuer(claims.iss)) {
            return failFlow(res, 401, "ID token issuer mismatch");
        }
        if (claims.nonce !== flow.nonce) {
            return failFlow(res, 401, "ID token nonce mismatch");
        }
        if (String(claims.email_verified) !== "true") {
            return failFlow(res, 401, "Google email is not verified");
        }

        const email = String(claims.email).toLowerCase();

        // Find-or-create / link the account. New OAuth users are always customers.
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({
                name: claims.name || email.split("@")[0],
                email,
                provider: "google",
                googleId: claims.sub,
                role: "customer",
            });
        } else if (!user.googleId) {
            user.googleId = claims.sub;
            if (user.provider === "local") user.provider = "google";
            await user.save();
        }

        // Clear the flow cookie and issue our own application JWT.
        res.setHeader("Set-Cookie", `${FLOW_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
        const appToken = generateToken(user);

        if (env.OAUTH_SUCCESS_REDIRECT) {
            // Hand the token to the SPA via the URL fragment (not sent to servers/logs).
            return res.redirect(`${env.OAUTH_SUCCESS_REDIRECT}#token=${appToken}`);
        }
        return res.status(200).json({
            success: true,
            data: { id: user._id, name: user.name, email: user.email, role: user.role },
            token: appToken,
        });
    } catch (error) {
        if (error.response) {
            return failFlow(res, 401, "Google authentication failed");
        }
        next(error);
    }
};

module.exports = { googleStart, googleCallback };