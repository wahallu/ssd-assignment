const express = require("express");
const router = express.Router();
const {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    reserveSeats,
    releaseSeats,
} = require("../controllers/eventController");
const { requireAuth, requireAdmin } = require("../middlewares/security");

// Public reads
router.get("/", getAllEvents);
router.get("/:id", getEventById);

// Seat adjustments — any authenticated user (called by Ticket Service on their behalf)
router.patch("/:id/reserve", requireAuth, reserveSeats);
router.patch("/:id/release", requireAuth, releaseSeats);

// Admin-only management
router.post("/", requireAuth, requireAdmin, createEvent);
router.put("/:id", requireAuth, requireAdmin, updateEvent);
router.delete("/:id", requireAuth, requireAdmin, deleteEvent);

module.exports = router;
