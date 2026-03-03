const calculateEMI = (principal, months) => {
  const annualRate = 0.12;
  const monthlyRate = annualRate / 12; // 1% per month

  const r = monthlyRate;
  const n = months;
  const P = principal;

  const emi =
    (P * r * Math.pow(1 + r, n)) /
    (Math.pow(1 + r, n) - 1);

  return Number(emi.toFixed(2));
};

module.exports = calculateEMI;