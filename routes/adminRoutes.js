const express = require("express");
const router = express.Router();

console.log("USER BALANCE BEFORE:", user.balance);
console.log("DEPOSIT AMOUNT:", deposit.amount);

const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");

const { db } = require("../config/firebase");

/* ======================================================
   ADMIN DASHBOARD STATS
====================================================== */
router.get("/dashboard", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const usersSnap = await db.collection("users").get();
    const depositsSnap = await db.collection("depositRequests")
      .where("status", "==", "pending")
      .get();
    const fraudSnap = await db.collection("fraudAlerts")
      .where("resolved", "==", false)
      .get();

    let totalVolume = 0;
    let creditSpend = 0;
    let transfers = 0;

    const transactionsSnap = await db.collectionGroup("transactions").get();

    transactionsSnap.forEach(doc => {
      const t = doc.data();
      totalVolume += t.amount || 0;
      if (t.type === "credit-spend") creditSpend += t.amount || 0;
      if (t.type === "transfer") transfers += t.amount || 0;
    });

    res.json({
      totalUsers: usersSnap.size,
      pendingDeposits: depositsSnap.size,
      fraudAlerts: fraudSnap.size,
      totalVolume,
      creditSpend,
      transfers
    });

  } catch (error) {
    res.status(500).json({ message: "Dashboard load failed" });
  }
});


/* ======================================================
   GET ALL USERS
====================================================== */
router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const users = [];

    snapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(users);

  } catch {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});


/* ======================================================
   PENDING DEPOSITS
====================================================== */
router.get("/deposit-requests", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("depositRequests")
      .where("status", "==", "pending")
      .get();

    const deposits = [];
    snapshot.forEach(doc => {
      deposits.push({ id: doc.id, ...doc.data() });
    });

    res.json(deposits);

  } catch {
    res.status(500).json({ message: "Failed to fetch deposits" });
  }
});


/* ======================================================
   APPROVE DEPOSIT
====================================================== */
router.post("/approve-deposit", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { depositId } = req.body;

    const depositRef = db.collection("depositRequests").doc(depositId);

    await db.runTransaction(async transaction => {
      const depositDoc = await transaction.get(depositRef);
      if (!depositDoc.exists) throw new Error("Deposit not found");

      const deposit = depositDoc.data();
      if (deposit.status !== "pending")
        throw new Error("Already processed");

      const userRef = db.collection("users").doc(deposit.userId);
      const userDoc = await transaction.get(userRef);
      const user = userDoc.data();

      transaction.update(userRef, {
        balance: (user.balance || 0) + deposit.amount
      });

      transaction.update(depositRef, {
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: req.user.uid
      });

      transaction.set(userRef.collection("transactions").doc(), {
        type: "deposit-approved",
        amount: deposit.amount,
        timestamp: new Date(),
        referenceId: "TXN" + Date.now(),
        status: "success"
      });
    });

    res.json({ message: "Deposit approved" });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


/* ======================================================
   LOAN REQUESTS
====================================================== */
router.get("/loan-requests", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("loanRequests")
      .where("status", "==", "pending")
      .get();

    const loans = [];
    snapshot.forEach(doc => {
      loans.push({ id: doc.id, ...doc.data() });
    });

    res.json(loans);

  } catch {
    res.status(500).json({ message: "Failed to fetch loans" });
  }
});


/* ======================================================
   FRAUD ALERTS
====================================================== */
router.get("/fraud-alerts", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("fraudAlerts")
      .where("resolved", "==", false)
      .get();

    const alerts = [];
    snapshot.forEach(doc => {
      alerts.push({ id: doc.id, ...doc.data() });
    });

    res.json(alerts);

  } catch {
    res.status(500).json({ message: "Failed to fetch fraud alerts" });
  }
});


/* ======================================================
   AUDIT LOGS
====================================================== */
router.get("/audit-logs", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("auditLogs")
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    res.json(logs);

  } catch {
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});


/* ======================================================
   ALL TRANSACTIONS (GLOBAL VIEW)
====================================================== */
router.get("/all-transactions", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collectionGroup("transactions")
      .orderBy("timestamp", "desc")
      .limit(200)
      .get();

    const transactions = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() });
    });

    res.json(transactions);

  } catch {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

// ======================================
// GET FRAUD ALERTS (SAFE)
// ======================================
router.get("/fraud-alerts", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("fraudAlerts").get();

    const alerts = [];

    snapshot.forEach(doc => {
      alerts.push({ id: doc.id, ...doc.data() });
    });

    console.log("Fraud Alerts Found:", alerts.length);

    res.json(alerts);

  } catch (err) {
    console.error("Fraud Fetch Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;