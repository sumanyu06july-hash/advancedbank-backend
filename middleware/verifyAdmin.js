const { db } = require("../config/firebase");

const verifyAdmin = async (req, res, next) => {
  try {
    const uid = req.user.uid;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(403).json({ message: "User not found" });
    }

    if (userDoc.data().role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: "Admin verification failed" });
  }
};

module.exports = verifyAdmin;