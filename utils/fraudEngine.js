const { db } = require("../config/firebase");

const FRAUD_LIMIT = 50000;

const checkFraud = async (uid, user, amount) => {
  let reason = null;

  if (amount > FRAUD_LIMIT) {
    reason = "High value transaction";
  }

  const creditUsageRatio =
    (user.creditUsed || 0) / (user.creditLimit || 1);

  if (creditUsageRatio > 0.9) {
    reason = "Credit over 90%";
  }

  if (reason) {
    // 🔴 Create fraud alert document
    await db.collection("fraudAlerts").add({
      userId: uid,
      reason,
      amount,
      status: "active",
      createdAt: new Date(),
    });

    return { freeze: true, reason };
  }

  return { freeze: false };
};

module.exports = checkFraud;