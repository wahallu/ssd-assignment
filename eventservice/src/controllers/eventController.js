const Event = require("../models/Event");

// @desc    Create a new event (admin only — enforced by route guard)
// @route   POST /api/events
const createEvent = async (req, res, next) => {
    try {
        const { name, location, date, availableSeats, price } = req.body;

        const event = await Event.create({ name, location, date, availableSeats, price });

        res.status(201).json({ success: true, data: event });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all events (public)
// @route   GET /api/events
const getAllEvents = async (req, res, next) => {
    try {
        const events = await Event.find().sort({ date: 1 });
        res.status(200).json({ success: true, count: events.length, data: events });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single event by ID (public)
// @route   GET /api/events/:id
const getEventById = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: `Event not found with id ${req.params.id}`,
            });
        }
        res.status(200).json({
            success: true,
            data: {
                _id: event._id,
                name: event.name,
                location: event.location,
                date: event.date,
                availableSeats: event.availableSeats,
                price: event.price,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update an event (admin only — enforced by route guard)
// @route   PUT /api/events/:id
const updateEvent = async (req, res, next) => {
    try {
        // Whitelist updatable fields (no mass assignment).
        const updates = {};
        ["name", "location", "date", "availableSeats", "price"].forEach((f) => {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        });

        const event = await Event.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: `Event not found with id ${req.params.id}`,
            });
        }

        res.status(200).json({ success: true, data: event });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete an event (admin only — enforced by route guard)
// @route   DELETE /api/events/:id
const deleteEvent = async (req, res, next) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: `Event not found with id ${req.params.id}`,
            });
        }
        res.status(200).json({ success: true, message: "Event deleted successfully", data: event });
    } catch (error) {
        next(error);
    }
};

// @desc    Atomically reserve seats (used by Ticket Service during booking).
//          Prevents the read-then-write race that allowed overselling.
// @route   PATCH /api/events/:id/reserve   body: { seatCount }
const reserveSeats = async (req, res, next) => {
    try {
        const seatCount = Number(req.body.seatCount);
        if (!Number.isInteger(seatCount) || seatCount < 1) {
            return res.status(400).json({ success: false, message: "seatCount must be a positive integer" });
        }

        // Conditional atomic decrement: only succeeds if enough seats remain.
        const event = await Event.findOneAndUpdate(
            { _id: req.params.id, availableSeats: { $gte: seatCount } },
            { $inc: { availableSeats: -seatCount } },
            { new: true }
        );

        if (!event) {
            // Either the event does not exist or there are not enough seats.
            const exists = await Event.exists({ _id: req.params.id });
            return res.status(exists ? 409 : 404).json({
                success: false,
                message: exists ? "Insufficient seats available" : "Event not found",
            });
        }

        res.status(200).json({ success: true, data: { _id: event._id, availableSeats: event.availableSeats, price: event.price } });
    } catch (error) {
        next(error);
    }
};

// @desc    Return previously reserved seats (used on cancellation).
// @route   PATCH /api/events/:id/release   body: { seatCount }
const releaseSeats = async (req, res, next) => {
    try {
        const seatCount = Number(req.body.seatCount);
        if (!Number.isInteger(seatCount) || seatCount < 1) {
            return res.status(400).json({ success: false, message: "seatCount must be a positive integer" });
        }

        const event = await Event.findByIdAndUpdate(
            req.params.id,
            { $inc: { availableSeats: seatCount } },
            { new: true }
        );

        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        res.status(200).json({ success: true, data: { _id: event._id, availableSeats: event.availableSeats } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    reserveSeats,
    releaseSeats,
};
