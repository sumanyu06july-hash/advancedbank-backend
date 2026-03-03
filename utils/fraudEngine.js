const FRAUD_LIMIT = 50000;

const checkFraud = (user, amount) => {
  if (amount > FRAUD_LIMIT) {
    return { freeze: true, reason: "High value transaction" };
  }

  const creditUsageRatio =
    (user.creditUsed || 0) / (user.creditLimit || 1);

  if (creditUsageRatio > 0.9) {
    return { freeze: true, reason: "Credit over 90%" };
  }

  return { freeze: false };
};

module.exports = checkFraud;