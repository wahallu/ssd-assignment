const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      // Not required for accounts created through an OAuth/OIDC provider.
      required: [
        function () {
          return this.provider === "local";
        },
        "Password is required",
      ],
    },
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: {
      type: String,
      index: true,
      sparse: true,
    },
    role: {
      type: String,
      required: true,
      enum: {
        values: ["admin", "customer"],
        message: "Role must be either admin or customer",
      },
      default: "customer",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
