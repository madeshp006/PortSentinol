import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { userRepository } from "../repositories/userRepository.js";
import { alertRepository } from "../repositories/alertRepository.js";
import { authRequired } from "../middleware/auth.js";
import { signToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { serialize } from "../utils/serialize.js";
import { sendMail } from "../utils/mailer.js";

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
    passwordHash,
  });

  await alertRepository.create({
    userId: user.id,
    title: "Welcome to PortSentinel",
    message: "Your account is ready. Run your first scan to start building history.",
    risk: "info",
  });

  const accessToken = signToken(user);
  const refreshToken = signRefreshToken(user);

  await userRepository.update(user.id, { refreshToken });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.status(201).json({
    session: { access_token: accessToken, refresh_token: refreshToken },
    user: { id: user.id, email: user.email },
    profile: profileForUser(user),
  });
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

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = signToken(user);
  const refreshToken = signRefreshToken(user);

  await userRepository.update(user.id, { refreshToken });

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

// ─── Forgot password: send 6-digit OTP to email ──────────────────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (user) {
    const otpCode = `${Math.floor(100000 + Math.random() * 900000)}`;
    await userRepository.update(user.id, {
      otpCode,
      otpExpiresAt: new Date(Date.now() + 1000 * 60 * 15),
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });

    await sendMail({
      to: user.email,
      subject: "PortSentinel — Password Reset Code",
      text: `Your PortSentinel password reset code is: ${otpCode}\n\nIt expires in 15 minutes. If you did not request this, ignore this email.`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;background:#060e1e;color:#c8d8f0;border-radius:12px;padding:32px;border:1px solid #1c3254">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
            <span style="font-size:20px;font-weight:700;color:#e8f0fe">Port<span style="color:#38bdf8">Sentinel</span></span>
          </div>
          <h2 style="font-size:18px;font-weight:700;color:#e8f0fe;margin:0 0 8px">Password Reset Code</h2>
          <p style="font-size:14px;color:#4a6080;margin:0 0 24px;line-height:1.6">
            Use the code below to reset your password. It expires in <strong style="color:#c8d8f0">15 minutes</strong>.
          </p>
          <div style="background:#0a1e38;border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#38bdf8">${otpCode}</span>
          </div>
          <p style="font-size:12px;color:#3a5070;line-height:1.6;margin:0">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
    });
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
  if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
  }
  if (String(otpCode).trim() !== String(user.otpCode).trim()) {
    return res.status(400).json({ error: "Incorrect verification code." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.update(user.id, {
    passwordHash,
    otpCode: null,
    otpExpiresAt: null,
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

  const matches = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!matches) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const otpCode = `${Math.floor(100000 + Math.random() * 900000)}`;
  await userRepository.update(user.id, {
    otpCode,
    otpExpiresAt: new Date(Date.now() + 1000 * 60 * 10),
  });

  await sendMail({
    to: user.email,
    subject: "Your PortSentinel verification code",
    text: `Your verification code is ${otpCode}. It expires in 10 minutes.`,
    html: `<p>Your verification code is <strong>${otpCode}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });

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

  if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Verification code expired. Request a new one." });
  }

  if (String(otpCode).trim() != String(user.otpCode).trim()) {
    return res.status(400).json({ error: "Invalid verification code" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.update(user.id, {
    passwordHash,
    otpCode: null,
    otpExpiresAt: null,
  });

  return res.json({ success: true });
});

export default router;
