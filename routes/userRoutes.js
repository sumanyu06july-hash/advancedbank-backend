const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

router.get("/profile", verifyToken, async (req, res) => {
  res.json({
    message: "Protected route accessed",
    uid: req.user.uid,
    email: req.user.email,
  });
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

  } catch (err) {
    res.status(400).json({ message: "Deposit request failed" });
  }
});

module.exports = router;