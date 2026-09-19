import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/userService";

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!form.email || !form.password) {
            setError("Please fill in all fields");
            return;
        }

        setLoading(true);
        try {
            const res = await loginUser(form);
            // Backend returns { success, data: { id, name, email, role }, token }
            const userData = {
                _id: res.data.id,
                name: res.data.name,
                email: res.data.email,
                role: res.data.role,
            };
            localStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("token", res.token);
            navigate("/events");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Welcome Back</h1>
                    <p>Sign in to your account</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={handleChange}
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </form>

                <div className="auth-divider"><span>or</span></div>

                <a
                    href={`${import.meta.env.VITE_API_URL || "http://localhost:7000"}/api/users/auth/google`}
                    className="btn btn-outline btn-full"
                >
                    Continue with Google
                </a>

                <p className="auth-footer">
                    Don't have an account? <Link to="/users/register">Sign up</Link>
                </p>
            </div>
        </div>
    );
}