const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

router.get("/profile", verifyToken, async (req, res) => {
  res.json({
    message: "Protected route accessed",
    uid: req.user.uid,
    email: req.user.email,
  });
});

module.exports = router;