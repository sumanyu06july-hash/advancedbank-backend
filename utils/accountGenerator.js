const generateAccountNumber = () => {
  return "AC" + Date.now() + Math.floor(Math.random() * 1000);
};

module.exports = generateAccountNumber;