const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const verifyToken = require("../middleware/verifyToken");
const { db } = require("../config/firebase");

const SALT_ROUNDS = 10;

// SET UPI PIN
router.post("/set-pin", verifyToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const uid = req.user.uid;

    if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
      return res.status(400).json({ message: "PIN must be 4 digits" });
    }

    const hash = await bcrypt.hash(pin, SALT_ROUNDS);

    await db.collection("users").doc(uid).update({
      upiPinHash: hash,
      upiAttempts: 0,
      upiLocked: false,
    });

    res.json({ message: "UPI PIN set successfully" });

  } catch (error) {
    res.status(500).json({ message: "Failed to set PIN" });
  }
});

// VERIFY UPI PIN
router.post("/verify-pin", verifyToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const uid = req.user.uid;

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();

    if (userData.upiLocked) {
      return res.status(403).json({ message: "UPI is locked. Contact admin." });
    }

    const isMatch = await bcrypt.compare(pin, userData.upiPinHash);

    if (!isMatch) {
      const attempts = (userData.upiAttempts || 0) + 1;

      await userRef.update({ upiAttempts: attempts });

      if (attempts >= 3) {
        await userRef.update({ upiLocked: true });
        return res.status(403).json({ message: "UPI locked after 3 failed attempts" });
      }

      return res.status(401).json({ message: "Incorrect PIN" });
    }

    await userRef.update({ upiAttempts: 0 });

    res.json({ message: "PIN verified successfully" });

  } catch (error) {
    res.status(500).json({ message: "PIN verification failed" });
  }
});

module.exports = router;