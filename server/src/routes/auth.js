import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { userRepository } from "../repositories/userRepository.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { authRequired } from "../middleware/auth.js";
import { signToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { serialize } from "../utils/serialize.js";
import { logAudit } from "../services/audit.js";
import { getSupabase } from "../utils/supabase.js";

const router = Router();

function profileForUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "Security Analyst",
    company: user.company || "PortSentinel Lab",
    createdAt: user.createdAt,
  };
}

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = await userRepository.findByEmail(normalizedEmail);
  if (exists) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password: passwordHash,
    isVerified: false,
    role: "USER",
  });

  // Supabase Auth SignUp
  try {
    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.signUp({
      email: normalizedEmail,
      password: password,
    });

    if (error) {
      console.error("Supabase signup error:", error.message);
      if (!error.message.includes("already registered")) {
        throw error;
      }
    }
  } catch (err) {
    console.error("Failed to trigger Supabase verification:", err.message);
    return res.status(500).json({ error: "Failed to trigger Supabase verification: " + err.message });
  }

  return res.status(201).json({
    requireVerification: true,
    email: user.email,
    message: "Verification OTP sent to your email address."
  });
});

router.post("/verify-signup", async (req, res) => {
  const { email, otpCode } = req.body || {};
  if (!email?.trim() || !otpCode?.trim()) {
    return res.status(400).json({ error: "Email and verification code are required" });
  }

  const user = await userRepository.findByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.isVerified) {
    return res.status(400).json({ error: "Account is already verified" });
  }

  // Supabase verify OTP
  try {
    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.verifyOtp({
      email: user.email,
      token: String(otpCode).trim(),
      type: "signup",
    });

    if (error) {
      return res.status(400).json({ error: "Invalid or expired verification code: " + error.message });
    }
  } catch (err) {
    return res.status(500).json({ error: "Verification failed: " + err.message });
  }

  // Mark verified
  const updatedUser = await userRepository.update(user.id, {
    isVerified: true,
  });

  // Create welcome alert
  await alertRepository.create({
    userId: updatedUser.id,
    title: "Welcome to PortSentinel",
    message: "Your account is verified and ready. Run your first scan to start building history.",
    risk: "info",
  });

  await logAudit({
    userId: updatedUser.id,
    action: "user.register",
    entityType: "user",
    entityId: updatedUser.id,
  });

  // Sign Token
  const accessToken = signToken(updatedUser);
  const refreshToken = signRefreshToken(updatedUser);

  await userRepository.update(updatedUser.id, { refreshToken });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({
    session: { access_token: accessToken, refresh_token: refreshToken },
    user: { id: updatedUser.id, email: updatedUser.email },
    profile: profileForUser(updatedUser),
  });
});

router.post("/resend-signup-otp", async (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await userRepository.findByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.isVerified) {
    return res.status(400).json({ error: "Account is already verified" });
  }

  // Supabase resend signup OTP
  try {
    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.resend({
      type: "signup",
      email: user.email,
    });

    if (error) {
      throw error;
    }
  } catch (err) {
    return res.status(500).json({ error: "Failed to resend verification email: " + err.message });
  }

  return res.json({ success: true, message: "Verification code sent successfully" });
});

router.post("/signin", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await userRepository.findByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    await logAudit({
      userId: user.id,
      action: "user.login.failed",
      entityType: "user",
      entityId: user.id,
      metadata: { reason: "incorrect_password" },
    });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (!user.isActive) {
    await logAudit({
      userId: user.id,
      action: "user.login.failed",
      entityType: "user",
      entityId: user.id,
      metadata: { reason: "account_disabled" },
    });
    return res.status(403).json({ error: "Account is disabled. Please contact administrator." });
  }

  if (!user.isVerified) {
    // Resend signup verification via Supabase
    try {
      const supabaseClient = getSupabase();
      const { error } = await supabaseClient.auth.resend({
        type: "signup",
        email: user.email,
      });
      if (error) throw error;
    } catch (err) {
      console.error("Failed to resend verification email on login:", err.message);
    }

    return res.status(403).json({
      error: "Please verify your email to log in. Verification code sent!",
      requireVerification: true,
      email: user.email
    });
  }

  const accessToken = signToken(user);
  const refreshToken = signRefreshToken(user);

  await userRepository.update(user.id, { refreshToken });

  await logAudit({
    userId: user.id,
    action: "user.login",
    entityType: "user",
    entityId: user.id,
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({
    session: { access_token: accessToken, refresh_token: refreshToken },
    user: { id: user.id, email: user.email },
    profile: profileForUser(user),
  });
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token is required" });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const user = await userRepository.findById(payload.userId);
  if (!user || user.refreshToken !== refreshToken) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  const accessToken = signToken(user);
  const newRefreshToken = signRefreshToken(user);

  await userRepository.update(user.id, { refreshToken: newRefreshToken });

  res.cookie("refresh_token", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    session: { access_token: accessToken, refresh_token: newRefreshToken },
  });
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body.refresh_token;
  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload) {
      await userRepository.update(payload.userId, { refreshToken: null });
    }
  }
  res.clearCookie("refresh_token");
  return res.json({ success: true });
});

// ─── Forgot password: send 6-digit OTP to email via Supabase ──────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (user) {
    try {
      const supabaseClient = getSupabase();
      const { error } = await supabaseClient.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to trigger forgot-password OTP:", err.message);
    }
  }

  // Always return success to avoid email enumeration
  return res.json({ success: true });
});

// ─── Reset password: verify OTP and set new password (unauthenticated) ───────
router.post("/reset-password", async (req, res) => {
  const { email, otpCode, newPassword } = req.body || {};

  if (!email?.trim() || !otpCode || !newPassword) {
    return res.status(400).json({ error: "Email, OTP code, and new password are required" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user) {
    return res.status(400).json({ error: "Invalid or expired code. Please request a new one." });
  }

  try {
    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.verifyOtp({
      email: normalizedEmail,
      token: String(otpCode).trim(),
      type: "recovery",
    });

    if (error) {
      return res.status(400).json({ error: "Invalid or expired reset code: " + error.message });
    }
  } catch (err) {
    return res.status(500).json({ error: "Verification failed: " + err.message });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.update(user.id, {
    password: passwordHash,
  });

  return res.json({ success: true });
});

// ─── OTP send (authenticated — for in-app password change) ───────────────────
router.post("/otp/send", authRequired, async (req, res) => {
  const { oldPassword } = req.body || {};
  if (!oldPassword) {
    return res.status(400).json({ error: "Current password is required" });
  }

  const user = await userRepository.findById(req.auth.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const matches = await bcrypt.compare(oldPassword, user.password);
  if (!matches) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  try {
    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.resetPasswordForEmail(user.email);
    if (error) throw error;
  } catch (err) {
    return res.status(500).json({ error: "Failed to send verification code: " + err.message });
  }

  return res.json({ success: true, email: user.email });
});

// ─── Change password (authenticated — in-app) ────────────────────────────────
router.post("/change-password", authRequired, async (req, res) => {
  const { otpCode, newPassword } = req.body || {};
  if (!otpCode || !newPassword) {
    return res.status(400).json({ error: "OTP code and new password are required" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await userRepository.findById(req.auth.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  try {
    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.auth.verifyOtp({
      email: user.email,
      token: String(otpCode).trim(),
      type: "recovery",
    });

    if (error) {
      return res.status(400).json({ error: "Invalid or expired verification code: " + error.message });
    }
  } catch (err) {
    return res.status(500).json({ error: "Verification failed: " + err.message });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.update(user.id, {
    password: passwordHash,
  });

  return res.json({ success: true });
});

export default router;
