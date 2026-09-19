import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserById } from "../services/userService";

/**
 * Landing page for the Google OIDC redirect.
 * The user service redirects here with the application JWT in the URL fragment
 * (#token=...). The fragment is never sent to any server, so the token is not
 * leaked in logs or referrers. We store it and load the profile.
 */
export default function OAuthCallback() {
    const navigate = useNavigate();
    const [error, setError] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const token = params.get("token");
        if (!token) {
            setError("Google sign-in failed. Please try again.");
            return;
        }
        localStorage.setItem("token", token);

        // Decode the (already gateway-verified) JWT payload to learn who we are.
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            getUserById(payload.id)
                .then((res) => {
                    localStorage.setItem(
                        "user",
                        JSON.stringify({
                            _id: res.data.id,
                            name: res.data.name,
                            email: res.data.email,
                            role: res.data.role,
                        })
                    );
                    // Clear the token from the address bar, then continue.
                    window.history.replaceState({}, document.title, "/events");
                    navigate("/events", { replace: true });
                })
                .catch(() => {
                    setError("Could not load your profile.");
                });
        } catch {
            setError("Invalid sign-in response.");
        }
    }, [navigate]);

    return (
        <div className="page-center">
            {error ? (
                <div className="alert alert-error">{error}</div>
            ) : (
                <>
                    <div className="spinner" />
                    <p>Signing you in…</p>
                </>
            )}
        </div>
    );
}
