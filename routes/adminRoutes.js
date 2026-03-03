const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const { db } = require("../config/firebase");

/* ======================================================
   ADMIN DASHBOARD
====================================================== */
router.get("/dashboard", verifyToken, verifyAdmin, async (req, res) => {
  res.json({
    message: "Admin authenticated",
    adminId: req.user.uid
  });
});

/* ======================================================
   LIST ALL USERS
====================================================== */
router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  const snapshot = await db.collection("users").get();
  const users = [];
  snapshot.forEach(doc => {
    users.push({ uid: doc.id, ...doc.data() });
  });
  res.json(users);
});

/* ======================================================
   FREEZE / UNFREEZE USER
====================================================== */
router.post("/freeze-user/:uid", verifyToken, verifyAdmin, async (req, res) => {
  const { freeze } = req.body;
  const uid = req.params.uid;

  await db.collection("users").doc(uid).update({
    isFrozen: freeze
  });

  await db.collection("auditLogs").add({
    action: freeze ? "FREEZE_USER" : "UNFREEZE_USER",
    userId: uid,
    adminId: req.user.uid,
    timestamp: new Date()
  });

  res.json({ message: "User status updated" });
});

/* ======================================================
   UNLOCK UPI
====================================================== */
router.post("/unlock-upi", verifyToken, verifyAdmin, async (req, res) => {
  const { targetUid } = req.body;

  await db.collection("users").doc(targetUid).update({
    upiLocked: false,
    upiAttempts: 0
  });

  await db.collection("auditLogs").add({
    action: "UNLOCK_UPI",
    userId: targetUid,
    adminId: req.user.uid,
    timestamp: new Date()
  });

  res.json({ message: "UPI unlocked" });
});

/* ======================================================
   PENDING DEPOSITS
====================================================== */
router.get("/deposit-requests", verifyToken, verifyAdmin, async (req, res) => {
  const snapshot = await db.collection("depositRequests")
    .where("status", "==", "pending")
    .get();

  const data = [];
  snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));

  res.json(data);
});

/* ======================================================
   APPROVE DEPOSIT
====================================================== */
router.post("/approve-deposit/:id", verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const depositRef = db.collection("depositRequests").doc(id);

  await db.runTransaction(async (transaction) => {
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

  await db.collection("auditLogs").add({
    action: "APPROVE_DEPOSIT",
    userId: id,
    adminId: req.user.uid,
    timestamp: new Date()
  });

  res.json({ message: "Deposit approved" });
});

/* ======================================================
   LOAN REQUESTS
====================================================== */
router.get("/loan-requests", verifyToken, verifyAdmin, async (req, res) => {
  const snapshot = await db.collection("loanRequests")
    .where("status", "==", "pending")
    .get();

  const data = [];
  snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));

  res.json(data);
});

/* ======================================================
   APPROVE LOAN
====================================================== */
router.post("/approve-loan/:id", verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const loanRef = db.collection("loanRequests").doc(id);

  await db.runTransaction(async (transaction) => {
    const loanDoc = await transaction.get(loanRef);
    if (!loanDoc.exists) throw new Error("Loan not found");

    const loan = loanDoc.data();
    if (loan.status !== "pending")
      throw new Error("Already processed");

    const userRef = db.collection("users").doc(loan.userId);
    const userDoc = await transaction.get(userRef);
    const user = userDoc.data();

    transaction.update(userRef, {
      balance: (user.balance || 0) + loan.amount
    });

    transaction.update(loanRef, {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: req.user.uid
    });

    transaction.set(userRef.collection("transactions").doc(), {
      type: "loan-disbursed",
      amount: loan.amount,
      timestamp: new Date(),
      referenceId: "TXN" + Date.now(),
      status: "success"
    });
  });

  await db.collection("auditLogs").add({
    action: "APPROVE_LOAN",
    adminId: req.user.uid,
    timestamp: new Date()
  });

  res.json({ message: "Loan approved" });
});

/* ======================================================
   FRAUD ALERTS
====================================================== */
router.get("/fraud-alerts", verifyToken, verifyAdmin, async (req, res) => {
  const snapshot = await db.collection("fraudAlerts").get();
  const data = [];
  snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
  res.json(data);
});

/* ======================================================
   AUDIT LOGS
====================================================== */
router.get("/audit-logs", verifyToken, verifyAdmin, async (req, res) => {
  const snapshot = await db.collection("auditLogs")
    .orderBy("timestamp", "desc")
    .limit(100)
    .get();

  const data = [];
  snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
  res.json(data);
});

module.exports = router;