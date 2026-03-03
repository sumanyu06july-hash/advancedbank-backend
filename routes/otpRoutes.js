const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { db } = require("../config/firebase");
const twilio = require("twilio");
require("dotenv").config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ======================================
// SEND OTP
// ======================================
router.post("/send-otp", verifyToken, async (req, res) => {
  try {
    const { phone } = req.body;
    const uid = req.user.uid;

    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.collection("otpRequests").doc(uid).set({
      phone,
      otp,
      createdAt: new Date()
    });

    await client.messages.create({
      body: `Your QuantumBank OTP is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });

    res.json({ message: "OTP sent successfully" });

  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to send OTP"
    });
  }
});

// ======================================
// VERIFY OTP
// ======================================
router.post("/verify-otp", verifyToken, async (req, res) => {
  try {
    const { otp } = req.body;
    const uid = req.user.uid;

    const otpDoc = await db.collection("otpRequests").doc(uid).get();

    if (!otpDoc.exists) {
      return res.status(400).json({ message: "No OTP request found" });
    }

    const data = otpDoc.data();

    const now = new Date();
    const createdAt = new Date(data.createdAt.toDate());
    const diffMinutes = (now - createdAt) / (1000 * 60);

    if (diffMinutes > 5) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (data.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await db.collection("users").doc(uid).update({
      phoneVerified: true,
      phoneNumber: data.phone
    });

    await db.collection("otpRequests").doc(uid).delete();

    res.json({ message: "Phone verified successfully" });

  } catch (error) {
    res.status(400).json({
      message: error.message || "OTP verification failed"
    });
  }
});

module.exports = router;