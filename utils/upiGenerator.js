const generateUpiId = (email) => {
  const prefix = email.split("@")[0];
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}@quantumbank`;
};

module.exports = generateUpiId;