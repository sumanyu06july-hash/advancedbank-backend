const admin = require("firebase-admin");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log("AUTH HEADER:", authHeader);

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    console.log("TOKEN RECEIVED LENGTH:", token.length);

    const decodedToken = await admin.auth().verifyIdToken(token);

    console.log("TOKEN VERIFIED FOR:", decodedToken.email);

    req.user = decodedToken;

    next();

  } catch (error) {
    console.error("VERIFY ERROR:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = verifyToken;