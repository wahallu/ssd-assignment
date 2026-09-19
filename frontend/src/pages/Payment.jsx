import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getTicketById } from "../services/ticketService";
import { createPayment } from "../services/paymentService";

export default function Payment() {
    const { ticketId } = useParams();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user"));

    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user) {
            navigate("/users/login");
            return;
        }

        const fetchTicket = async () => {
            try {
                const res = await getTicketById(ticketId);
                setTicket(res.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchTicket();
    }, [ticketId]);

    const handlePayment = async () => {
        setError("");
        setProcessing(true);
        try {
            // Only the ticket id and method are sent. The server sets the amount
            // (from the ticket), marks the payment completed and confirms the
            // ticket — the client can no longer pay 0 or self-confirm a booking.
            await createPayment({
                ticketId: ticket._id,
                paymentMethod: "card",
            });

            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="page-center">
                <div className="spinner" />
                <p>Loading payment details…</p>
            </div>
        );
    }

    if (success) {
        return (
            <div className="page">
                <div className="success-card">
                    <div className="success-icon">✅</div>
                    <h1>Payment Successful!</h1>
                    <p>Your tickets have been booked successfully.</p>
                    <div className="success-details">
                        <p><strong>Ticket ID:</strong> {ticket._id}</p>
                        <p><strong>Seats:</strong> {ticket.seatCount}</p>
                        <p><strong>Amount Paid:</strong> ${ticket.price.toFixed(2)}</p>
                    </div>
                    <div className="success-actions">
                        <Link to="/my-tickets" className="btn btn-primary">
                            View My Tickets
                        </Link>
                        <Link to="/events" className="btn btn-outline">
                            Browse More Events
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="page">
                <div className="alert alert-error">Ticket not found</div>
                <Link to="/events" className="btn btn-outline">← Back to Events</Link>
            </div>
        );
    }

    return (
        <div className="page">
            <Link to="/events" className="back-link">← Back to Events</Link>

            <div className="payment-card">
                <h1>Complete Payment</h1>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="payment-summary">
                    <div className="payment-row">
                        <span>Ticket ID</span>
                        <span className="mono">{ticket._id}</span>
                    </div>
                    <div className="payment-row">
                        <span>Seats</span>
                        <span>{ticket.seatCount}</span>
                    </div>
                    <div className="payment-row">
                        <span>Status</span>
                        <span className="badge badge-warning">{ticket.status}</span>
                    </div>
                    <div className="payment-row payment-total">
                        <span>Total Amount</span>
                        <span>${ticket.price.toFixed(2)}</span>
                    </div>
                </div>

                <div className="payment-note">
                    <p>💳 This is a simulated payment. No real charges will be made.</p>
                </div>

                <button
                    onClick={handlePayment}
                    className="btn btn-primary btn-full btn-lg"
                    disabled={processing}
                >
                    {processing ? "Processing Payment…" : `Pay $${ticket.price.toFixed(2)}`}
                </button>
            </div>
        </div>
    );
}
