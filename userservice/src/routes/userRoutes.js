const express = require("express");
const router = express.Router();

const {
    registerUser,
    loginUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
} = require("../controllers/userController");

const { requireAuth, requireAdmin } = require("../middlewares/security");

/**
 * Allow the action only when the caller is the resource owner or an admin.
 * Closes the IDOR where any user could read/modify/delete any other account.
 */
const requireSelfOrAdmin = (req, res, next) => {
    if (req.auth.role === "admin" || req.auth.userId === req.params.id) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: "You may only access your own account",
    });
};

// Public routes (also rate-limited at the gateway)
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected routes
router.get("/", requireAuth, requireAdmin, getAllUsers);
router.get("/:id", requireAuth, requireSelfOrAdmin, getUserById);
router.put("/:id", requireAuth, requireSelfOrAdmin, updateUser);
router.delete("/:id", requireAuth, requireSelfOrAdmin, deleteUser);

module.exports = router;
