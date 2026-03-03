const calculateInterest = (creditUsed, lastApplied) => {
  if (!creditUsed || creditUsed <= 0 || !lastApplied) {
    return { interest: 0, daysPassed: 0 };
  }

  let lastDate;

  // Proper Firestore Timestamp handling
  if (typeof lastApplied.toDate === "function") {
    lastDate = lastApplied.toDate();
  } else {
    lastDate = new Date(lastApplied);
  }

  if (isNaN(lastDate.getTime())) {
    return { interest: 0, daysPassed: 0 };
  }

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;

  const daysPassed = Math.floor((now - lastDate) / msPerDay);

  if (daysPassed <= 0) {
    return { interest: 0, daysPassed: 0 };
  }

  const dailyRate = 0.12 / 365;
  const interest = Number(creditUsed) * dailyRate * daysPassed;

  return {
    interest: Number(interest.toFixed(2)),
    daysPassed
  };
};

module.exports = calculateInterest;