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

  // Supabase Auth SignUp: Dispatches default signup confirmation link
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
    message: "A verification link has been sent to your email address."
  });
});

//verify-signup is now a status check helper for checking link status
router.post("/verify-signup", async (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await userRepository.findByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    verified: user.isVerified,
    message: "Verification is checked automatically during login."
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

  // Supabase resends default confirmation link
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

  return res.json({ success: true, message: "Verification link sent successfully" });
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

  // Check verification via Supabase on login if not yet marked verified locally
  if (!user.isVerified) {
    try {
      const supabaseClient = getSupabase();
      const { data: sbData, error: sbError } = await supabaseClient.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (!sbError && sbData?.user?.email_confirmed_at) {
        // Confirmed! Update Aiven DB
        await userRepository.update(user.id, { isVerified: true });
        user.isVerified = true;

        // Welcome Alert
        await alertRepository.create({
          userId: user.id,
          title: "Welcome to PortSentinel",
          message: "Your account is verified and ready. Run your first scan to start building history.",
          risk: "info",
        });
      } else {
        // Resend confirmation link
        await supabaseClient.auth.resend({
          type: "signup",
          email: user.email,
        });

        return res.status(403).json({
          error: "Please confirm your email by clicking the confirmation link sent to your inbox.",
          requireVerification: true,
          email: user.email
        });
      }
    } catch (err) {
      console.error("Supabase signin check failed:", err.message);
      return res.status(403).json({
        error: "Please confirm your email by clicking the confirmation link sent to your inbox.",
        requireVerification: true,
        email: user.email
      });
    }
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

// ─── Forgot password: sends default reset link via Supabase ─────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (user) {
    try {
      const clientOrigin = process.env.CLIENT_ORIGIN || "https://portsentinel.vercel.app";
      const redirectTo = `${clientOrigin.replace(/\/$/, "")}/auth`;
      
      const supabaseClient = getSupabase();
      const { error } = await supabaseClient.auth.resetPasswordForEmail(user.email, { redirectTo });
      if (error) throw error;
    } catch (err) {
      console.error("Failed to trigger forgot-password link:", err.message);
    }
  }

  // Always return success to prevent email scanning/enumeration attacks
  return res.json({ success: true });
});

// ─── Reset password: uses accessToken from recovery link to reset password ──
router.post("/reset-password", async (req, res) => {
  const { otpCode, accessToken, newPassword } = req.body || {};
  const token = accessToken || otpCode; // support both parameters for frontend compatibility

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Access token/reset token and new password are required" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  try {
    const supabaseClient = getSupabase();
    // Resolve user details using the access token
    const { data: { user: sbUser }, error: sbError } = await supabaseClient.auth.getUser(token);

    if (sbError || !sbUser || !sbUser.email) {
      return res.status(400).json({ error: "Invalid or expired recovery session. Please request a new link." });
    }

    const user = await userRepository.findByEmail(sbUser.email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found in Aiven database" });
    }

    // Hash and update local database
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user.id, {
      password: passwordHash,
      isVerified: true // mark verified as recovery link implies ownership
    });

    // Sync back password to Supabase Auth so logins continue working
    await supabaseClient.auth.updateUser({ password: newPassword });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Reset password failed: " + err.message });
  }
});

// ─── OTP send (no longer needed, returned as success) ───────────────────────
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

  return res.json({ success: true, email: user.email });
});

// ─── Change password (authenticated — direct password update) ───────────────
router.post("/change-password", authRequired, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await userRepository.findById(req.auth.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const matches = await bcrypt.compare(oldPassword, user.password);
  if (!matches) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.update(user.id, {
    password: passwordHash,
  });

  // Keep Supabase Auth password in sync
  try {
    const supabaseClient = getSupabase();
    await supabaseClient.auth.updateUser({ password: newPassword });
  } catch (err) {
    console.warn("Could not sync password change to Supabase:", err.message);
  }

  return res.json({ success: true });
});

export default router;
