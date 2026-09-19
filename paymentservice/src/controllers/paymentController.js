const axios = require("axios");
const Payment = require("../models/Payment");
const env = require("../config/env");

const TICKET_SERVICE_URL = env.TICKET_SERVICE_URL;

// --------------- Helpers ---------------

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
    const err = new Error("Ticket Service is unavailable. Please try again later.");
    err.statusCode = 503;
    return err;
};

const fetchTicket = async (req, ticketId) => {
    try {
        const { data } = await axios.get(`${TICKET_SERVICE_URL}/api/tickets/${ticketId}`, {
            headers: internalHeaders(req),
        });
        return data.data;
    } catch (error) {
        throw wrapServiceError(error, `Ticket not found with id ${ticketId}`);
    }
};

const confirmTicket = async (req, ticketId) => {
    try {
        await axios.patch(`${TICKET_SERVICE_URL}/api/tickets/${ticketId}/confirm`, {}, {
            headers: internalHeaders(req),
        });
    } catch (error) {
        throw wrapServiceError(error, "Failed to confirm ticket");
    }
};

const isOwnerOrAdmin = (req, payment) =>
    req.auth.role === "admin" || String(payment.userId) === req.auth.userId;

// --------------- Controllers ---------------

// @desc    Process a payment for the authenticated user's own ticket
// @route   POST /api/payments
const createPayment = async (req, res, next) => {
    try {
        const { ticketId, paymentMethod } = req.body;
        const userId = req.auth.userId; // from verified token, not the body

        if (!ticketId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: ticketId, paymentMethod",
            });
        }
        const validMethods = ["card", "cash", "online"];
        if (!validMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: `paymentMethod must be one of: ${validMethods.join(", ")}`,
            });
        }

        const ticket = await fetchTicket(req, ticketId);
        if (!ticket) {
            return res.status(404).json({ success: false, message: `Ticket not found with id ${ticketId}` });
        }

        // Authorisation: a user may only pay for their own ticket.
        if (req.auth.role !== "admin" && String(ticket.userId) !== userId) {
            return res.status(403).json({ success: false, message: "You can only pay for your own ticket" });
        }

        // Amount and status are authoritative on the server side — the client
        // cannot pay 0 or mark its own payment "completed".
        const amount = Number(ticket.price);

        const existing = await Payment.findOne({ ticketId, status: "completed" });
        if (existing) {
            return res.status(409).json({ success: false, message: "This ticket is already paid" });
        }

        const payment = await Payment.create({
            ticketId,
            userId,
            amount,
            paymentMethod,
            status: "completed", // simulated gateway success; set only by the server
        });

        // Confirm the ticket now that payment succeeded.
        await confirmTicket(req, ticketId);

        res.status(201).json({
            success: true,
            data: {
                _id: payment._id,
                ticketId: payment.ticketId,
                userId: payment.userId,
                amount: payment.amount,
                paymentMethod: payment.paymentMethod,
                status: payment.status,
                paymentDate: payment.paymentDate,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get payments — own only for customers, all for admins
// @route   GET /api/payments
const getAllPayments = async (req, res, next) => {
    try {
        const filter = req.auth.role === "admin" ? {} : { userId: req.auth.userId };
        const payments = await Payment.find(filter).sort({ paymentDate: -1 });
        res.status(200).json({ success: true, count: payments.length, data: payments });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single payment (owner or admin)
// @route   GET /api/payments/:id
const getPaymentById = async (req, res, next) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, message: `Payment not found with id ${req.params.id}` });
        }
        if (!isOwnerOrAdmin(req, payment)) {
            return res.status(403).json({ success: false, message: "Not authorized to view this payment" });
        }
        res.status(200).json({ success: true, data: payment });
    } catch (error) {
        next(error);
    }
};

// @desc    Get payments by user ID (self or admin)
// @route   GET /api/payments/user/:userId
const getPaymentsByUserId = async (req, res, next) => {
    try {
        if (req.auth.role !== "admin" && req.params.userId !== req.auth.userId) {
            return res.status(403).json({ success: false, message: "Not authorized to view these payments" });
        }
        const payments = await Payment.find({ userId: req.params.userId }).sort({ paymentDate: -1 });
        res.status(200).json({ success: true, count: payments.length, data: payments });
    } catch (error) {
        next(error);
    }
};

// @desc    Update payment status (admin only — enforced by route guard)
// @route   PUT /api/payments/:id
const updatePayment = async (req, res, next) => {
    try {
        const updates = {};
        if (["pending", "completed", "failed"].includes(req.body.status)) {
            updates.status = req.body.status;
        } else {
            return res.status(400).json({ success: false, message: "Invalid or missing status" });
        }
        const payment = await Payment.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        });
        if (!payment) {
            return res.status(404).json({ success: false, message: `Payment not found with id ${req.params.id}` });
        }
        res.status(200).json({ success: true, data: payment });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a payment (admin only — enforced by route guard)
// @route   DELETE /api/payments/:id
const deletePayment = async (req, res, next) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, message: `Payment not found with id ${req.params.id}` });
        }
        res.status(200).json({ success: true, message: "Payment deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    getPaymentsByUserId,
    updatePayment,
    deletePayment,
};
