const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { db} = require("../config/firebase");

router.get("/profile", verifyToken, async (req, res) => {
  res.json({
    message: "Protected route accessed",
    uid: req.user.uid,
    email: req.user.email,
  });
});

// ============================
// GET USER LOAN REQUESTS (DEBUG)
// ============================
router.get("/my-loans", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const snapshot = await db
      .collection("loanRequests")
      .where("userId", "==", uid)
      .get();

    const loans = [];

    snapshot.forEach(doc => {
      loans.push({ id: doc.id, ...doc.data() });
    });

    res.json(loans);

  } catch (err) {
    console.error("MY LOANS ERROR:", err);
    res.status(500).json({
      error: err.message,
      full: err
    });
  }
});



// ============================
// REQUEST LOAN
// ============================
router.post("/request-loan", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const uid = req.user.uid;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Optional: Prevent multiple active loans
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();
    if (user.loanActive) {
      return res.status(400).json({ message: "Loan already active" });
    }

    await db.collection("loanRequests").add({
      userId: uid,
      amount,
      status: "pending",
      createdAt: new Date()
    });

    res.json({ message: "Loan request submitted" });

  } catch (err) {
    console.error("Loan Request Error:", err);
    res.status(400).json({ message: err.message });
  }
});

// ============================
// TRIGGER FRAUD (TESTING)
// ============================
router.post("/trigger-fraud", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userRef = db.collection("users").doc(uid);

    await userRef.update({
      isFrozen: true,
      freezeReason: "Manual fraud trigger",
    });

    await db.collection("fraudAlerts").add({
      userId: uid,
      reason: "Manual fraud trigger",
      createdAt: new Date(),
      status: "active"
    });

    res.json({ message: "Fraud alert triggered" });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ============================
// REQUEST DEPOSIT
// ============================
router.post("/request-deposit", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const uid = req.user.uid;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    await db.collection("depositRequests").add({
      userId: uid,
      amount,
      status: "pending",
      createdAt: new Date()
    });

    res.json({ message: "Deposit request submitted" });

  }catch (err) {
  console.error("Deposit Error:", err);
  res.status(400).json({ 
    message: err.message || "Deposit request failed" 
  });
}
});

module.exports = router;