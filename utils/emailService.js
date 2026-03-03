const sgMail = require("@sendgrid/mail");
require("dotenv").config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html) => {
  const msg = {
    to,
    from: process.env.EMAIL_FROM,
    subject,
    html
  };

  await sgMail.send(msg);
};

const buildTransactionEmail = (type, amount, referenceId, balance) => {
  return `
    <h2>Transaction Alert - QuantumBank</h2>
    <p><strong>Transaction Type:</strong> ${type}</p>
    <p><strong>Amount:</strong> ₹${amount}</p>
    <p><strong>Reference ID:</strong> ${referenceId}</p>
    <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    <hr />
    <p><strong>Available Balance:</strong> ₹${balance}</p>
    <br/>
    <p>If you did not authorize this transaction, contact support immediately.</p>
  `;
};

module.exports = { sendEmail, buildTransactionEmail };
