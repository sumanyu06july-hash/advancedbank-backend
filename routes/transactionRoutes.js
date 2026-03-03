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
   SECURE TRANSFER (WITH FRAUD + AUDIT + EMAIL)
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

      // 🔐 FRAUD CHECK
      const fraudCheck = checkFraud(user, amount);
      if (fraudCheck.freeze) {
        transaction.update(userRef, {
          isFrozen: true,
          freezeReason: fraudCheck.reason
        });
        throw new Error("Account frozen due to suspicious activity");
      }

      let newBalance = user.balance || 0;
      let newCreditUsed = user.creditUsed || 0;

      if (source === "balance") {
        if (user.role !== "admin" && newBalance < amount)
          throw new Error("Insufficient balance");
        if (user.role !== "admin") newBalance -= amount;
      }

      if (source === "credit") {
        const available = (user.creditLimit || 0) - newCreditUsed;
        if (user.role !== "admin" && available < amount)
          throw new Error("Credit limit exceeded");
        if (user.role !== "admin") newCreditUsed += amount;
      }

      transaction.update(userRef, {
        balance: newBalance,
        creditUsed: newCreditUsed
      });

      transaction.set(userRef.collection("transactions").doc(), {
        type: source === "credit" ? "credit-spend" : "transfer",
        amount,
        source,
        referenceId,
        timestamp: new Date(),
        status: "success"
      });
    });

    // ✅ AUDIT LOG (after commit)
    await logAudit(uid, "TRANSFER", { amount, source, referenceId });

    // ✅ EMAIL ALERT
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
   CREDIT REPAYMENT (INTEREST FIRST)
====================================================== */
router.post("/repay-credit", verifyToken, verifyFullyVerified, async (req, res) => {
  try {
    const { amount, method, pin } = req.body;
    const uid = req.user.uid;
    const userRef = db.collection("users").doc(uid);
    const referenceId = "TXN" + Date.now();

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");

      const user = userDoc.data();

      if (method === "pin") {
        const match = await bcrypt.compare(pin, user.upiPinHash);
        if (!match) throw new Error("Invalid PIN");
      }

      let interest = user.interestAccrued || 0;
      let principal = user.creditUsed || 0;
      let balance = user.balance || 0;

      if (principal <= 0 && interest <= 0)
        throw new Error("No outstanding dues");

      if (user.role !== "admin" && balance < amount)
        throw new Error("Insufficient balance");

      let remaining = amount;

      const interestPaid = Math.min(remaining, interest);
      interest -= interestPaid;
      remaining -= interestPaid;

      const principalPaid = Math.min(remaining, principal);
      principal -= principalPaid;

      const totalPaid = interestPaid + principalPaid;

      transaction.update(userRef, {
        balance: user.role === "admin" ? balance : balance - totalPaid,
        creditUsed: principal,
        interestAccrued: interest
      });

      transaction.set(userRef.collection("transactions").doc(), {
        type: "credit-repayment",
        totalPaid,
        interestPaid,
        principalPaid,
        referenceId,
        timestamp: new Date(),
        status: "success"
      });
    });

    await logAudit(uid, "CREDIT_REPAYMENT", { amount, referenceId });

    res.json({ message: "Credit repaid successfully" });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


/* ======================================================
   APPLY INTEREST
====================================================== */
router.post("/apply-interest", verifyToken, verifyFullyVerified, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");

      const user = userDoc.data();

      if (!user.creditUsed || user.creditUsed <= 0)
        throw new Error("No credit used");

      const { interest } = calculateInterest(
        user.creditUsed,
        user.lastInterestApplied
      );

      if (interest <= 0)
        throw new Error("No interest to apply yet");

      transaction.update(userRef, {
        interestAccrued: (user.interestAccrued || 0) + interest,
        lastInterestApplied: new Date()
      });

      transaction.set(userRef.collection("transactions").doc(), {
        type: "interest-applied",
        amount: interest,
        referenceId: "TXN" + Date.now(),
        timestamp: new Date(),
        status: "success"
      });
    });

    await logAudit(uid, "INTEREST_APPLIED", {});

    res.json({ message: "Interest applied successfully" });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


/* ======================================================
   TRANSACTION HISTORY
====================================================== */
router.get("/history", verifyToken, verifyFullyVerified, async (req, res) => {
  try {
    const uid = req.user.uid;

    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    const transactions = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() });
    });

    res.json(transactions);

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


/* ======================================================
   PRODUCTS LIST
====================================================== */
router.get("/products", verifyToken, verifyFullyVerified, async (req, res) => {
  const snapshot = await db.collection("products")
    .where("active", "==", true)
    .get();

  const products = [];
  snapshot.forEach(doc => {
    products.push({ id: doc.id, ...doc.data() });
  });

  res.json(products);
});

module.exports = router;