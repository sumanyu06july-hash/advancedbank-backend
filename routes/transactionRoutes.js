const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const verifyToken = require("../middleware/verifyToken");
const verifyFullyVerified = require("../middleware/verifyFullyVerified");

const { db } = require("../config/firebase");
const calculateInterest = require("../utils/interestCalculator");
const { sendEmail, buildTransactionEmail } = require("../utils/emailService");
const checkFraud = require("../utils/fraudEngine");
const logAudit = require("../utils/auditLogger");

/* ======================================================
   CREDIT SUMMARY
====================================================== */
router.get("/credit-summary", verifyToken, verifyFullyVerified, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists)
      return res.status(404).json({ message: "User not found" });

    const user = userDoc.data();

    res.json({
      creditLimit: user.creditLimit || 0,
      creditUsed: user.creditUsed || 0,
      interestAccrued: user.interestAccrued || 0,
      totalDue: (user.creditUsed || 0) + (user.interestAccrued || 0),
      availableCredit: (user.creditLimit || 0) - (user.creditUsed || 0),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/* ======================================================
   SECURE TRANSFER
====================================================== */
router.post("/transfer", verifyToken, verifyFullyVerified, async (req, res) => {
  try {
    const { amount, method, pin, source } = req.body;
    const uid = req.user.uid;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    if (!["balance", "credit"].includes(source))
      return res.status(400).json({ message: "Invalid source" });

    const userRef = db.collection("users").doc(uid);
    const referenceId = "TXN" + Date.now();

    let fraudResult = { freeze: false };

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");

      const user = userDoc.data();

      if (user.isFrozen) throw new Error("Account frozen");
      if (user.upiLocked) throw new Error("UPI locked");

      if (method === "pin") {
        const match = await bcrypt.compare(pin, user.upiPinHash);
        if (!match) throw new Error("Invalid PIN");
      }

      // ✅ FRAUD CHECK (NO WRITES HERE)
      fraudResult = checkFraud(user, amount);

      if (fraudResult.freeze) {
        transaction.update(userRef, {
          isFrozen: true,
          freezeReason: fraudResult.reason,
        });
        return; // stop further transaction updates
      }

      let newBalance = user.balance || 0;
      let newCreditUsed = user.creditUsed || 0;

      if (source === "balance") {
        if (newBalance < amount)
          throw new Error("Insufficient balance");
        newBalance -= amount;
      }

      if (source === "credit") {
        const available =
          (user.creditLimit || 0) - newCreditUsed;
        if (available < amount)
          throw new Error("Credit limit exceeded");
        newCreditUsed += amount;
      }

      transaction.update(userRef, {
        balance: newBalance,
        creditUsed: newCreditUsed,
      });

      transaction.set(
        userRef.collection("transactions").doc(),
        {
          type: source === "credit" ? "credit-spend" : "transfer",
          amount,
          source,
          referenceId,
          timestamp: new Date(),
          status: "success",
        }
      );
    });

    // 🔴 If Fraud Triggered → Create Alert Outside Transaction
    if (fraudResult.freeze) {
      await db.collection("fraudAlerts").add({
        userId: uid,
        reason: fraudResult.reason,
        amount,
        status: "active",
        createdAt: new Date(),
      });

      return res.status(400).json({
        message: "Account frozen due to suspicious activity",
      });
    }

    await logAudit(uid, "TRANSFER", { amount, source, referenceId });

    const updatedUser = await userRef.get();
    const userData = updatedUser.data();

    await sendEmail(
      req.user.email,
      "Transaction Alert - QuantumBank",
      buildTransactionEmail(
        source === "credit" ? "Credit Spend" : "Transfer",
        amount,
        referenceId,
        userData.balance
      )
    );

    res.json({ message: "Transfer successful" });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/* ======================================================
   TRANSACTION HISTORY
====================================================== */
router.get("/history", verifyToken, async (req, res) => {
  try {

    console.log("UID:", req.user.uid);
    const uid = req.user.uid;

    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .orderBy("timestamp", "desc")
      .get();

    const transactions = [];

    snapshot.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(transactions);

  } catch (err) {

    console.error("Transaction History Error:", err);

    res.status(500).json({
      message: "Failed to fetch transactions"
    });

  }
});

module.exports = router;