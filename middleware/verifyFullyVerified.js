const { db } = require("../config/firebase");

const verifyFullyVerified = async (req, res, next) => {
  try {
    const uid = req.user.uid;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userDoc.data();

    if (!req.user.email_verified) {
      return res.status(403).json({
        message: "Email not verified"
      });
    }

    if (!user.phoneVerified) {
      return res.status(403).json({
        message: "Phone not verified"
      });
    }

    next();

  } catch (error) {
    res.status(400).json({
      message: "Verification check failed"
    });
  }
};

module.exports = verifyFullyVerified;