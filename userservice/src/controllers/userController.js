const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

// ─── Helpers ────────────────────────────────────────────────────

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
    );
};

/**
 * Enforce a minimum password policy:
 * at least 8 characters and a mix of letters and numbers.
 */
const validatePassword = (password) => {
    if (typeof password !== "string" || password.length < 8) {
        return "Password must be at least 8 characters long";
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return "Password must contain both letters and numbers";
    }
    return null;
};

const publicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
});

// ─── Controllers ────────────────────────────────────────────────

// POST /api/users/register — Create a new user (always a customer)
const registerUser = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide name, email, and password",
            });
        }

        const pwError = validatePassword(password);
        if (pwError) {
            return res.status(400).json({ success: false, message: pwError });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "A user with this email already exists",
            });
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // SECURITY: role is NOT taken from the request body (mass-assignment /
        // privilege-escalation fix). Self-registration always yields a customer.
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: "customer",
        });

        res.status(201).json({
            success: true,
            data: publicUser(user),
            token: generateToken(user),
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/users/login — Validate user credentials
const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password || typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password",
            });
        }

        const user = await User.findOne({ email });

        // Uniform response + always run a hash comparison to reduce user
        // enumeration and timing differences between "no user" and "bad password".
        const hash = user ? user.password : "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinv";
        const isMatch = await bcrypt.compare(password, hash);

        if (!user || !isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            token: generateToken(user),
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/users — Retrieve all users (admin only, enforced by route guard)
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select("-password");
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        next(error);
    }
};

// GET /api/users/:id — Retrieve a single user (self or admin, enforced by route guard)
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: publicUser(user) });
    } catch (error) {
        next(error);
    }
};

// PUT /api/users/:id — Update user details (self or admin, enforced by route guard)
const updateUser = async (req, res, next) => {
    try {
        const updates = {};

        // Only whitelisted fields may be updated — prevents mass assignment.
        if (typeof req.body.name === "string") updates.name = req.body.name;
        if (typeof req.body.email === "string") updates.email = req.body.email;

        if (req.body.password !== undefined) {
            const pwError = validatePassword(req.body.password);
            if (pwError) {
                return res.status(400).json({ success: false, message: pwError });
            }
            const salt = await bcrypt.genSalt(12);
            updates.password = await bcrypt.hash(req.body.password, salt);
        }

        // SECURITY: only an admin may change a role, and it must be a valid value.
        // A customer can never escalate their own (or anyone's) privileges.
        if (req.body.role !== undefined) {
            if (req.auth.role !== "admin") {
                return res.status(403).json({
                    success: false,
                    message: "Only an administrator can change a user's role",
                });
            }
            if (!["admin", "customer"].includes(req.body.role)) {
                return res.status(400).json({ success: false, message: "Invalid role" });
            }
            updates.role = req.body.role;
        }

        const user = await User.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        }).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, data: publicUser(user) });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/users/:id — Delete a user (self or admin, enforced by route guard)
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerUser,
    loginUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    generateToken,
    validatePassword,
    publicUser,
};
