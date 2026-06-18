import jwt from "jsonwebtoken";
import { userRepository } from "../repositories/userRepository.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Alias for backwards compatibility
export const authRequired = requireAuth;

export async function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const user = await userRepository.findById(req.auth.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is disabled. Please contact administrator." });
      }
      if (user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Access denied. Super Admin role required." });
      }
      req.user = user;
      next();
    } catch (err) {
      return res.status(500).json({ error: "Authorization error: " + err.message });
    }
  });
}

export async function requireAnalyst(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const user = await userRepository.findById(req.auth.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is disabled. Please contact administrator." });
      }
      if (user.role !== "SUPER_ADMIN" && user.role !== "SECURITY_ANALYST") {
        return res.status(403).json({ error: "Access denied. Security Analyst or Super Admin role required." });
      }
      req.user = user;
      next();
    } catch (err) {
      return res.status(500).json({ error: "Authorization error: " + err.message });
    }
  });
}

export async function requireUser(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const user = await userRepository.findById(req.auth.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is disabled. Please contact administrator." });
      }
      req.user = user;
      next();
    } catch (err) {
      return res.status(500).json({ error: "Authorization error: " + err.message });
    }
  });
}
