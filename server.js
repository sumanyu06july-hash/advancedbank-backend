require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

require("./config/firebase");

const cors = require("cors");

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://your-admin-site.onrender.com"
  ],
  credentials: true
}));

const app = express();
app.get("/", (req, res) => {
  res.send("QuantumBank Backend Running 🚀");
});

app.use(cors());
app.use(express.json());
app.use("/user", require("./routes/userRoutes"));
app.use("/auth", require("./routes/authRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/pin", require("./routes/pinRoutes"));
app.use("/transaction", require("./routes/transactionRoutes"));
app.use("/otp", require("./routes/otpRoutes"));

app.get("/debug-user/:uid", async (req, res) => {
  try {
    const user = await admin.auth().getUser(req.params.uid);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("AdvancedBank Backend Running");
});



const PORT = process.env.PORT || 5000;

app.get("/test-email", async (req, res) => {
  const { sendEmail } = require("./utils/emailService");

  await sendEmail(
    "spotifypremium.06072010@gmail.com",
    "QuantumBank Email Test",
    "<h1>Email system working successfully</h1>"
  );

  res.json({ message: "Email sent" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});