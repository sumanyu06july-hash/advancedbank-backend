const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

/* ================================
   APP INITIALIZATION
================================ */
const app = express();

/* ================================
   MIDDLEWARE
================================ */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

/* ================================
   ROUTES
================================ */
app.use("/auth", require("./routes/authRoutes"));
app.use("/transaction", require("./routes/transactionRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/user", require("./routes/userRoutes"));
app.use("/otp", require("./routes/otpRoutes"));
app.use("/pin", require("./routes/pinRoutes"));

/* ================================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("AdvancedBank Backend Running");
});

/* ================================
   SERVER START
================================ */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});