const express = require("express");
const router = express.Router();
const {
    createPayment,
    getAllPayments,
    getPaymentById,
    getPaymentsByUserId,
    updatePayment,
    deletePayment,
} = require("../controllers/paymentController");
const { requireAuth, requireAdmin } = require("../middlewares/security");

router.post("/", requireAuth, createPayment);
router.get("/", requireAuth, getAllPayments);

// NOTE: user route must be defined BEFORE /:id
router.get("/user/:userId", requireAuth, getPaymentsByUserId);

router.get("/:id", requireAuth, getPaymentById);

// Status changes / deletions are administrative operations.
router.put("/:id", requireAuth, requireAdmin, updatePayment);
router.delete("/:id", requireAuth, requireAdmin, deletePayment);

module.exports = router;
