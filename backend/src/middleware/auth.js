// backend/src/middleware/auth.js
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("CRITICAL: JWT_SECRET is not defined in .env! Authentication will fail.");
}

export async function auth(req, res, next) {
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

    let resolvedLocationId = decoded.location_id;

    // If the user is flagged as Headquarters (is_hq) or is an admin, 
    // dynamically resolve/ensure they map to the main Company Headquarters location ID from the database
    if (decoded.is_hq || decoded.role === 'admin') {
      try {
        const hqResult = await pool.query("SELECT id FROM locations WHERE is_hq = true LIMIT 1");
        if (hqResult.rows.length > 0) {
          resolvedLocationId = hqResult.rows[0].id;
        }
      } catch (dbErr) {
        console.error("Error resolving HQ location in auth middleware:", dbErr.message);
      }
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      location_id: resolvedLocationId, // 👈 Synchronized to Company Headquarters if HQ/Admin
      is_hq: decoded.is_hq,            
      can_download: decoded.can_download ?? false 
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