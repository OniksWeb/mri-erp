// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("CRITICAL: JWT_SECRET is not defined in .env! Authentication will fail.");
}

export function auth(req, res, next) {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res.status(401).json({ message: "No token, authorization denied." });
  }

  const token = authHeader.split(" ")[1]; // Extract after "Bearer "

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // ✅ Attach only the fields you care about
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      can_download: decoded.can_download ?? false // 👈 ensure it’s always boolean
    };

    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    res.status(401).json({ message: "Token is not valid or expired." });
  }
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied: Insufficient role permissions." });
    }
    next();
  };
}
