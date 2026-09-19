const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Event name is required"],
            trim: true,
        },
        location: {
            type: String,
            required: [true, "Event location is required"],
            trim: true,
        },
        date: {
            type: Date,
            required: [true, "Event date is required"],
        },
        availableSeats: {
            type: Number,
            required: [true, "Available seats count is required"],
            min: [0, "Available seats cannot be negative"],
        },
        // Authoritative price per seat. Tickets are priced from this value,
        // never from a value supplied by the client.
        price: {
            type: Number,
            required: [true, "Ticket price is required"],
            min: [0, "Price cannot be negative"],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Event", eventSchema);
