const express = require("express");
const router = express.Router();

const { googleStart, googleCallback } = require("../controllers/oauthController");

// GET /api/users/auth/google           — begin Google OIDC login
router.get("/google", googleStart);

// GET /api/users/auth/google/callback  — OIDC redirect target
router.get("/google/callback", googleCallback);

module.exports = router;
