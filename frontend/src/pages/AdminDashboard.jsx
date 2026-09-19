import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getAllEvents,
    createEvent,
    updateEvent,
    deleteEvent,
} from "../services/eventService";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        name: "",
        location: "",
        date: "",
        availableSeats: "",
        price: "",
    });
    const [submitting, setSubmitting] = useState(false);

    // Delete confirmation
    const [deleteId, setDeleteId] = useState(null);

    const fetchEvents = async () => {
        try {
            const res = await getAllEvents();
            setEvents(res.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const resetForm = () => {
        setForm({ name: "", location: "", date: "", availableSeats: "", price: "" });
        setEditing(null);
        setShowModal(false);
    };

    const openCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const openEdit = (event) => {
        setEditing(event);
        setForm({
            name: event.name,
            location: event.location,
            date: event.date ? event.date.split("T")[0] : "",
            availableSeats: event.availableSeats,
            price: event.price ?? "",
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setSubmitting(true);

        try {
            const payload = {
                ...form,
                availableSeats: Number(form.availableSeats),
                price: Number(form.price),
            };

            if (editing) {
                await updateEvent(editing._id, payload);
                setSuccess("Event updated successfully");
            } else {
                await createEvent(payload);
                setSuccess("Event created successfully");
            }

            resetForm();
            await fetchEvents();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setError("");
        setSuccess("");

        try {
            await deleteEvent(deleteId);
            setSuccess("Event deleted successfully");
            setDeleteId(null);
            await fetchEvents();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    if (loading) {
        return (
            <div className="page-center">
                <div className="spinner" />
                <p>Loading dashboard…</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>🛠️ Admin Dashboard</h1>
                    <p className="page-subtitle">Manage events</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    + Create Event
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Stats */}
            <div className="admin-stats">
                <div className="stat-card">
                    <span className="stat-icon">📅</span>
                    <div>
                        <div className="stat-value">{events.length}</div>
                        <div className="stat-label">Total Events</div>
                    </div>
                </div>
                <div className="stat-card">
                    <span className="stat-icon">💺</span>
                    <div>
                        <div className="stat-value">
                            {events.reduce((sum, e) => sum + (e.availableSeats || 0), 0)}
                        </div>
                        <div className="stat-label">Total Seats</div>
                    </div>
                </div>
                <div className="stat-card">
                    <span className="stat-icon">🟢</span>
                    <div>
                        <div className="stat-value">
                            {events.filter((e) => new Date(e.date) >= new Date()).length}
                        </div>
                        <div className="stat-label">Upcoming</div>
                    </div>
                </div>
            </div>

            {/* Events Table */}
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Location</th>
                            <th>Date</th>
                            <th>Seats</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="table-empty">
                                    No events found. Create your first event!
                                </td>
                            </tr>
                        ) : (
                            events.map((event) => {
                                const isUpcoming = new Date(event.date) >= new Date();
                                return (
                                    <tr key={event._id}>
                                        <td className="table-name">{event.name}</td>
                                        <td>{event.location}</td>
                                        <td>
                                            {new Date(event.date).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </td>
                                        <td>{event.availableSeats}</td>
                                        <td>
                                            <span
                                                className={`badge ${isUpcoming ? "badge-success" : "badge-warning"
                                                    }`}
                                            >
                                                {isUpcoming ? "Upcoming" : "Past"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => openEdit(event)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => setDeleteId(event._id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={resetForm}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? "Edit Event" : "Create Event"}</h2>
                            <button className="modal-close" onClick={resetForm}>
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label htmlFor="name">Event Name</label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    placeholder="Enter event name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="location">Location</label>
                                <input
                                    id="location"
                                    name="location"
                                    type="text"
                                    placeholder="Enter location"
                                    value={form.location}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="date">Date</label>
                                    <input
                                        id="date"
                                        name="date"
                                        type="date"
                                        value={form.date}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="availableSeats">Available Seats</label>
                                    <input
                                        id="availableSeats"
                                        name="availableSeats"
                                        type="number"
                                        min="1"
                                        placeholder="100"
                                        value={form.availableSeats}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="price">Price per Seat (USD)</label>
                                    <input
                                        id="price"
                                        name="price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="29.99"
                                        value={form.price}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={resetForm}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? "Saving…"
                                        : editing
                                            ? "Update Event"
                                            : "Create Event"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="modal-overlay" onClick={() => setDeleteId(null)}>
                    <div
                        className="modal-content modal-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2>Confirm Delete</h2>
                        </div>
                        <p className="modal-body-text">
                            Are you sure you want to delete this event? This action cannot be
                            undone.
                        </p>
                        <div className="modal-actions">
                            <button
                                className="btn btn-outline"
                                onClick={() => setDeleteId(null)}
                            >
                                Cancel
                            </button>
                            <button className="btn btn-danger" onClick={handleDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
