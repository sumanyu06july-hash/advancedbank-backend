const { db } = require("../config/firebase");

const verifyAdmin = async (req, res, next) => {
  try {
    /* ================= TOKEN CHECK ================= */
    if (!req.user || !req.user.uid) {
      return res.status(401).json({
        message: "Unauthorized - Invalid token"
      });
    }

    const uid = req.user.uid;

    /* ================= FETCH USER ================= */
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(403).json({
        message: "User not found"
      });
    }

    const user = userDoc.data();

    /* ================= ROLE CHECK ================= */
    if (!user.role || (user.role !== "admin" && user.role !== "superadmin")) {
      return res.status(403).json({
        message: "Admin access required"
      });
    }

    /* ================= ADMIN STATUS CHECK ================= */
    if (user.adminDisabled) {
      return res.status(403).json({
        message: "Admin access disabled"
      });
    }

    /* ================= ACCOUNT FREEZE CHECK ================= */
    if (user.isFrozen) {
      return res.status(403).json({
        message: "Admin account is frozen"
      });
    }

    /* ================= PASS THROUGH ================= */
    next();

  } catch (error) {
    console.error("VERIFY ADMIN ERROR:", error.message);

    return res.status(500).json({
      message: "Admin verification failed"
    });
  }
};

module.exports = verifyAdmin;