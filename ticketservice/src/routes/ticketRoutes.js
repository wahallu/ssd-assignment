const express = require("express");
const router = express.Router();
const {
    createTicket,
    getAllTickets,
    getTicketById,
    getTicketsByUserId,
    updateTicket,
    deleteTicket,
    confirmTicket,
} = require("../controllers/ticketController");
const { requireAuth } = require("../middlewares/security");

// All ticket routes require an authenticated user; ownership is checked per record.
router.post("/", requireAuth, createTicket);
router.get("/", requireAuth, getAllTickets);

// NOTE: user route must be defined BEFORE /:id
router.get("/user/:userId", requireAuth, getTicketsByUserId);

router.get("/:id", requireAuth, getTicketById);
router.put("/:id", requireAuth, updateTicket);
router.patch("/:id/confirm", requireAuth, confirmTicket);
router.delete("/:id", requireAuth, deleteTicket);

module.exports = router;
