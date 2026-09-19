import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getEventById } from "../services/eventService";
import { createTicket } from "../services/ticketService";

export default function Booking() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user"));

    const [event, setEvent] = useState(null);
    const [seatCount, setSeatCount] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) {
            navigate("/users/login");
            return;
        }

        const fetchEvent = async () => {
            try {
                const res = await getEventById(eventId);
                setEvent(res.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [eventId]);

    // Display price comes from the event; the authoritative price is applied
    // server-side when the ticket is created.
    const pricePerSeat = event?.price ?? 0;
    const totalPrice = (seatCount * pricePerSeat).toFixed(2);

    const handleBooking = async (e) => {
        e.preventDefault();
        setError("");

        if (seatCount < 1 || !Number.isInteger(Number(seatCount))) {
            setError("Please enter a valid number of seats (minimum 1)");
            return;
        }

        if (event && seatCount > event.availableSeats) {
            setError(
                `Only ${event.availableSeats} seats available. Please reduce your seat count.`
            );
            return;
        }

        setSubmitting(true);
        try {
            // Only the event and seat count are sent. The server derives the
            // owner (from the token), the price (from the event) and the status.
            const res = await createTicket({
                eventId,
                seatCount: Number(seatCount),
            });
            // Navigate to payment with the created ticket
            navigate(`/payment/${res.data._id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="page-center">
                <div className="spinner" />
                <p>Loading event…</p>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="page">
                <div className="alert alert-error">Event not found</div>
                <Link to="/events" className="btn btn-outline">← Back to Events</Link>
            </div>
        );
    }

    return (
        <div className="page">
            <Link to={`/events/${eventId}`} className="back-link">← Back to Event</Link>

            <div className="booking-layout">
                {/* Event Summary */}
                <div className="booking-summary">
                    <h2>Event Summary</h2>
                    <div className="summary-card">
                        <h3>{event.name}</h3>
                        <p>📍 {event.location}</p>
                        <p>📅 {new Date(event.date).toLocaleDateString("en-US", {
                            weekday: "short", year: "numeric", month: "short", day: "numeric",
                        })}</p>
                        <p>💺 {event.availableSeats} seats available</p>
                    </div>
                </div>

                {/* Booking Form */}
                <div className="booking-form-container">
                    <h2>Book Tickets</h2>

                    {error && <div className="alert alert-error">{error}</div>}

                    <form onSubmit={handleBooking} className="booking-form">
                        <div className="form-group">
                            <label htmlFor="seatCount">Number of Seats</label>
                            <input
                                id="seatCount"
                                type="number"
                                min="1"
                                max={event.availableSeats}
                                value={seatCount}
                                onChange={(e) => setSeatCount(Number(e.target.value))}
                            />
                        </div>

                        <div className="price-breakdown">
                            <div className="price-row">
                                <span>Price per seat</span>
                                <span>${pricePerSeat}</span>
                            </div>
                            <div className="price-row">
                                <span>Seats</span>
                                <span>× {seatCount}</span>
                            </div>
                            <div className="price-row price-total">
                                <span>Total</span>
                                <span>${totalPrice}</span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-full btn-lg"
                            disabled={submitting}
                        >
                            {submitting ? "Processing…" : `Proceed to Payment — $${totalPrice}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
