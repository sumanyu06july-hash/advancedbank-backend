const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const { db } = require("../config/firebase");

// ======================================
// ADMIN DASHBOARD
// ======================================
router.get("/dashboard", verifyToken, verifyAdmin, async (req, res) => {
  res.json({
    message: "Welcome Admin",
    uid: req.user.uid
  });
});

// ======================================
// UNLOCK UPI
// ======================================
router.post("/unlock-upi", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { targetUid } = req.body;

    if (!targetUid) {
      return res.status(400).json({ message: "Target UID required" });
    }

    await db.collection("users").doc(targetUid).update({
      upiLocked: false,
      upiAttempts: 0
    });

    res.json({ message: "UPI unlocked successfully" });

  } catch (error) {
    res.status(400).json({ message: "Unlock failed" });
  }
});

// ======================================
// VIEW PENDING DEPOSITS
// ======================================
router.get("/pending-deposits", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db
      .collection("depositRequests")
      .where("status", "==", "pending")
      .get();

    const deposits = [];

    snapshot.forEach(doc => {
      deposits.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(deposits);

  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to fetch deposits"
    });
  }
});

// ======================================
// APPROVE DEPOSIT
// ======================================
router.post("/approve-deposit", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { depositId } = req.body;

    if (!depositId) {
      return res.status(400).json({ message: "Deposit ID required" });
    }

    const depositRef = db.collection("depositRequests").doc(depositId);

    await db.runTransaction(async (transaction) => {
      const depositDoc = await transaction.get(depositRef);

      if (!depositDoc.exists) throw new Error("Deposit not found");

      const deposit = depositDoc.data();

      if (deposit.status !== "pending") {
        throw new Error("Deposit already processed");
      }

      const userRef = db.collection("users").doc(deposit.userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) throw new Error("User not found");

      const user = userDoc.data();
      const newBalance = (user.balance || 0) + deposit.amount;

      transaction.update(userRef, { balance: newBalance });

      transaction.update(depositRef, {
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: req.user.uid
      });

      const txnRef = userRef.collection("transactions").doc();

      transaction.set(txnRef, {
        type: "deposit-approved",
        amount: deposit.amount,
        timestamp: new Date(),
        referenceId: "TXN" + Date.now(),
        status: "success"
      });
    });

    res.json({ message: "Deposit approved successfully" });

  } catch (error) {
    res.status(400).json({
      message: error.message || "Deposit approval failed"
    });
  }
});

module.exports = router;