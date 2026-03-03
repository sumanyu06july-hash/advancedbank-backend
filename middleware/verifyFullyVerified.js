const { db } = require("../config/firebase");

const verifyFullyVerified = async (req, res, next) => {
  try {
    const uid = req.user.uid;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();

    // Email must be verified
    if (!req.user.email_verified) {
      return res.status(403).json({
        message: "Email not verified"
      });
    }

    // Optional: prevent frozen accounts
    if (user.isFrozen) {
      return res.status(403).json({
        message: "Account frozen"
      });
    }

    next();

  } catch (error) {
  console.error("VERIFY ERROR:", error);
  res.status(400).json({
    message: error.message
  });
}
};

module.exports = verifyFullyVerified;