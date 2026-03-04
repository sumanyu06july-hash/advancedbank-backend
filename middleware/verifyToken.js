const admin = require("firebase-admin");

const verifyToken = async (req, res, next) => {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = await admin.auth().verifyIdToken(token);

    req.user = decoded;

    next();

  } catch (error) {

    console.error("Token verification failed:", error);

    res.status(401).json({ error: "Invalid token" });

  }

};

module.exports = verifyToken;