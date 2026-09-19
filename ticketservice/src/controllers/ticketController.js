const axios = require("axios");
const Ticket = require("../models/Ticket");
const env = require("../config/env");

const EVENT_SERVICE_URL = env.EVENT_SERVICE_URL;

// --------------- Helpers ---------------

/**
 * Build the headers used for internal calls to the Event Service:
 * the shared internal key plus the authenticated user's identity, so the
 * Event Service can authorise the seat reservation on the user's behalf.
 */
const internalHeaders = (req) => ({
    "x-internal-key": env.INTERNAL_API_KEY,
    "x-user-id": req.auth.userId || "",
    "x-user-role": req.auth.role || "",
});

const wrapServiceError = (error, fallbackMsg) => {
    if (error.response) {
        const err = new Error(error.response.data?.message || fallbackMsg);
        err.statusCode = error.response.status;
        return err;
    }
    const err = new Error("Event Service is unavailable. Please try again later.");
    err.statusCode = 503;
    return err;
};

const fetchEvent = async (req, eventId) => {
    try {
        const { data } = await axios.get(`${EVENT_SERVICE_URL}/api/events/${eventId}`, {
            headers: internalHeaders(req),
        });
        return data.data;
    } catch (error) {
        throw wrapServiceError(error, `Event not found with id ${eventId}`);
    }
};

/** Atomically reserve seats; throws (409) if not enough seats remain. */
const reserveSeats = async (req, eventId, seatCount) => {
    try {
        const { data } = await axios.patch(
            `${EVENT_SERVICE_URL}/api/events/${eventId}/reserve`,
            { seatCount },
            { headers: internalHeaders(req) }
        );
        return data.data; // { availableSeats, price }
    } catch (error) {
        throw wrapServiceError(error, "Failed to reserve seats");
    }
};

const releaseSeats = async (req, eventId, seatCount) => {
    try {
        await axios.patch(
            `${EVENT_SERVICE_URL}/api/events/${eventId}/release`,
            { seatCount },
            { headers: internalHeaders(req) }
        );
    } catch (error) {
        throw wrapServiceError(error, "Failed to release seats");
    }
};

const isOwnerOrAdmin = (req, ticket) =>
    req.auth.role === "admin" || String(ticket.userId) === req.auth.userId;

// --------------- Controllers ---------------

// @desc    Create a new ticket for the authenticated user
// @route   POST /api/tickets
const createTicket = async (req, res, next) => {
    try {
        const { eventId, seatCount } = req.body;

        // Identity comes from the verified token, never the request body.
        const userId = req.auth.userId;

        if (!eventId || !seatCount) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: eventId, seatCount",
            });
        }
        if (!Number.isInteger(seatCount) || seatCount < 1) {
            return res.status(400).json({ success: false, message: "seatCount must be an integer >= 1" });
        }

        // Price is derived from the authoritative event price — the client
        // cannot dictate the price or the ticket status.
        const event = await fetchEvent(req, eventId);
        const reserved = await reserveSeats(req, eventId, seatCount); // atomic; enforces availability
        const price = Number((reserved.price * seatCount).toFixed(2));

        try {
            const ticket = await Ticket.create({
                eventId,
                userId,
                seatCount,
                price,
                status: "pending", // server-controlled; confirmed only after payment
            });
            res.status(201).json({ success: true, data: ticket });
        } catch (dbErr) {
            // Roll back the seat reservation if we could not persist the ticket.
            await releaseSeats(req, eventId, seatCount).catch(() => {});
            throw dbErr;
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Get tickets — a customer only ever sees their own; admins see all.
// @route   GET /api/tickets
const getAllTickets = async (req, res, next) => {
    try {
        const filter = req.auth.role === "admin" ? {} : { userId: req.auth.userId };
        const tickets = await Ticket.find(filter).sort({ bookingDate: -1 });
        res.status(200).json({ success: true, count: tickets.length, data: tickets });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single ticket by ID (owner or admin)
// @route   GET /api/tickets/:id
const getTicketById = async (req, res, next) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: `Ticket not found with id ${req.params.id}` });
        }
        if (!isOwnerOrAdmin(req, ticket)) {
            return res.status(403).json({ success: false, message: "Not authorized to view this ticket" });
        }
        res.status(200).json({ success: true, data: ticket });
    } catch (error) {
        next(error);
    }
};

// @desc    Get tickets by user ID (self or admin)
// @route   GET /api/tickets/user/:userId
const getTicketsByUserId = async (req, res, next) => {
    try {
        if (req.auth.role !== "admin" && req.params.userId !== req.auth.userId) {
            return res.status(403).json({ success: false, message: "Not authorized to view these tickets" });
        }
        const tickets = await Ticket.find({ userId: req.params.userId }).sort({ bookingDate: -1 });
        res.status(200).json({ success: true, count: tickets.length, data: tickets });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a ticket (owner or admin). Confirmation is done by the payment flow.
// @route   PUT /api/tickets/:id
const updateTicket = async (req, res, next) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: `Ticket not found with id ${req.params.id}` });
        }
        if (!isOwnerOrAdmin(req, ticket)) {
            return res.status(403).json({ success: false, message: "Not authorized to modify this ticket" });
        }

        // Only the status may be changed via this endpoint, to allowed values.
        const nextStatus = req.body.status;
        if (!["booked", "cancelled", "pending"].includes(nextStatus)) {
            return res.status(400).json({ success: false, message: "Invalid or missing status" });
        }

        // Marking a ticket as booked is only allowed once its payment completed.
        if (nextStatus === "booked" && req.auth.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Tickets are confirmed automatically once payment completes",
            });
        }

        if (nextStatus === "cancelled" && ticket.status !== "cancelled") {
            await releaseSeats(req, ticket.eventId, ticket.seatCount);
        }

        ticket.status = nextStatus;
        await ticket.save();

        res.status(200).json({ success: true, data: ticket });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a ticket (owner or admin)
// @route   DELETE /api/tickets/:id
const deleteTicket = async (req, res, next) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: `Ticket not found with id ${req.params.id}` });
        }
        if (!isOwnerOrAdmin(req, ticket)) {
            return res.status(403).json({ success: false, message: "Not authorized to delete this ticket" });
        }
        await ticket.deleteOne();
        res.status(200).json({ success: true, message: "Ticket deleted successfully" });
    } catch (error) {
        next(error);
    }
};

/** Internal helper used by the Payment Service to confirm a ticket after payment. */
// @route   PATCH /api/tickets/:id/confirm
const confirmTicket = async (req, res, next) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }
        if (!isOwnerOrAdmin(req, ticket)) {
            return res.status(403).json({ success: false, message: "Not authorized to confirm this ticket" });
        }
        ticket.status = "booked";
        await ticket.save();
        res.status(200).json({ success: true, data: ticket });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTicket,
    getAllTickets,
    getTicketById,
    getTicketsByUserId,
    updateTicket,
    deleteTicket,
    confirmTicket,
};
