const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { db } = require("../config/firebase");
const generateAccountNumber = require("../utils/accountGenerator");
const generateUpiId = require("../utils/upiGenerator");

router.post("/init-user", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const name = req.user.name || "User";

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      return res.json({ message: "User already initialized" });
    }

    const accountNumber = generateAccountNumber();
    const upiId = generateUpiId(email);

    await userRef.set({
      name,
      email,
      phone: "",
      role: "user",
      emailVerified: req.user.email_verified,
      phoneVerified: false,
      accountNumber,
      upiId,
      balance: 0,
      isFrozen: false,
      upiPinHash: "",
      upiAttempts: 0,
      upiLocked: false,
      creditLimit: 150000,
      creditUsed: 0,
      loanActive: false,
      createdAt: new Date(),
    });

    res.json({ message: "User initialized successfully" });

  } catch (error) {
    res.status(500).json({ message: "Initialization failed" });
  }
});

module.exports = router;