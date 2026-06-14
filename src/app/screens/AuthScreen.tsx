import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, Mail, Lock, Eye, EyeOff, User,
  ArrowRight, ChevronLeft, AlertCircle, CheckCircle, X, KeyRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

// ─── helpers ────────────────────────────────────────────────────────────────

const isValidEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ─── Input Field ─────────────────────────────────────────────────────────────

function Field({
  icon: Icon, placeholder, value, onChange, type = "text",
  error, rightEl, onFocus, label,
}: {
  icon: React.ElementType;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  rightEl?: React.ReactNode;
  onFocus?: () => void;
  label?: string;
}) {
  const hasError = !!error;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label style={{ fontSize: "11px", fontWeight: 500, color: "#4a6080", fontFamily: "Inter", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {label}
        </label>
      )}
      <div
        className="relative flex items-center rounded-2xl transition-all duration-200"
        style={{
          background: "rgba(6,14,30,0.9)",
          border: hasError
            ? "1px solid rgba(239,68,68,0.55)"
            : "1px solid rgba(28,50,84,0.9)",
          boxShadow: hasError ? "0 0 0 3px rgba(239,68,68,0.07)" : "none",
        }}
      >
        <Icon
          size={15}
          className="absolute left-4"
          style={{ color: hasError ? "#ef4444" : "#3a5070", flexShrink: 0 }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          type={type}
          autoComplete={type === "password" ? "current-password" : type === "email" ? "email" : "name"}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#c8d8f0",
            padding: "14px 16px 14px 40px",
            fontSize: "14px",
            fontFamily: "Inter",
            width: "100%",
            paddingRight: rightEl ? "44px" : "16px",
          }}
        />
        {rightEl && (
          <div className="absolute right-4">{rightEl}</div>
        )}
      </div>
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.16 }}
            className="flex items-center gap-1.5 px-1"
          >
            <AlertCircle size={11} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#ef4444", fontFamily: "Inter" }}>
              {error}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Banner ──────────────────────────────────────────────────────────────────

function Banner({
  type, msg, onClose,
}: { type: "error" | "success" | "info"; msg: string; onClose: () => void }) {
  const cfg = {
    error:   { bg: "rgba(239,68,68,0.09)",   border: "rgba(239,68,68,0.3)",   color: "#ef4444", Icon: AlertCircle },
    success: { bg: "rgba(34,197,94,0.09)",   border: "rgba(34,197,94,0.3)",   color: "#22c55e", Icon: CheckCircle },
    info:    { bg: "rgba(56,189,248,0.09)",  border: "rgba(56,189,248,0.3)",  color: "#38bdf8", Icon: CheckCircle },
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      className="flex items-start gap-2.5 rounded-2xl px-4 py-3 mb-4"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <cfg.Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1, fontSize: "12px", color: cfg.color, fontFamily: "Inter", lineHeight: 1.55 }}>
        {msg}
      </span>
      <button onClick={onClose}>
        <X size={13} style={{ color: cfg.color }} />
      </button>
    </motion.div>
  );
}

// ─── Forgot-password overlay (email OTP flow) ────────────────────────────────

type ForgotStep = "email" | "otp" | "success";

function ForgotPasswordOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<ForgotStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSendOtp = async (isResend = false) => {
    const trimmed = email.trim();
    if (!trimmed) { setErr("Please enter your email address."); return; }
    if (!isValidEmail(trimmed)) { setErr("Enter a valid email address."); return; }
    setErr("");
    setLoading(true);
    try {
      await api.forgotPassword(trimmed);
      setStep("otp");
      setResendCooldown(60);
    } catch (e: any) {
      setErr(e.message || "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async () => {
    if (otp.trim().length !== 6) { setErr("Enter the 6-digit code from your email."); return; }
    if (!newPassword) { setErr("Enter your new password."); return; }
    if (newPassword.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setErr("");
    setLoading(true);
    try {
      await api.resetPassword(email.trim(), otp.trim(), newPassword);
      setStep("success");
    } catch (e: any) {
      setErr(e.message || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="absolute inset-0 z-20 flex flex-col px-5 pt-6 pb-8"
      style={{ background: "#060e1e" }}
    >
      {/* Header */}
      {step !== "success" && (
        <button
          onClick={onClose}
          className="flex items-center gap-1 mb-6"
          style={{ color: "#4a6080", fontSize: "13px", fontFamily: "Inter" }}
        >
          <ChevronLeft size={16} /> Back to sign in
        </button>
      )}

      {/* Step: Enter email */}
      {step === "email" && (
        <>
          <div className="mb-8">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #0a1e38, #071526)", border: "1.5px solid rgba(56,189,248,0.2)", boxShadow: "0 0 18px rgba(56,189,248,0.12)" }}
            >
              <Mail size={20} color="#38bdf8" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter", marginBottom: "6px" }}>
              Reset your password
            </h2>
            <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter", lineHeight: 1.55 }}>
              Enter your registered email and we'll send you a 6-digit verification code.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Field
              icon={Mail}
              placeholder="your@email.com"
              type="email"
              value={email}
              onChange={(v) => { setEmail(v); setErr(""); }}
              error={err}
            />
            <motion.button
              whileTap={{ scale: loading ? 1 : 0.97 }}
              onClick={() => handleSendOtp(false)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-4"
              style={{ background: loading ? "rgba(14,107,176,0.5)" : "linear-gradient(135deg, #0e6bb0, #0a4f8a)", border: "1px solid rgba(56,189,248,0.3)", color: "#e8f4ff", fontSize: "15px", fontWeight: 600, fontFamily: "Inter", boxShadow: "0 4px 20px rgba(56,189,248,0.18)", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} style={{ width: 17, height: 17, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTop: "2px solid #e8f4ff" }} />
                  Sending code…
                </>
              ) : (
                <>Send Verification Code <ArrowRight size={17} /></>
              )}
            </motion.button>
            <p style={{ fontSize: "12px", color: "#3a5070", fontFamily: "Inter", textAlign: "center" }}>
              Remember your password?{" "}
              <button onClick={onClose} style={{ color: "#38bdf8" }}>Sign in</button>
            </p>
          </div>
        </>
      )}

      {/* Step: Enter OTP + new password */}
      {step === "otp" && (
        <>
          <div className="mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #0a1e38, #071526)", border: "1.5px solid rgba(56,189,248,0.2)", boxShadow: "0 0 18px rgba(56,189,248,0.12)" }}
            >
              <KeyRound size={20} color="#38bdf8" strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter", marginBottom: "6px" }}>
              Enter your code
            </h2>
            <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter", lineHeight: 1.55 }}>
              We sent a 6-digit code to <span style={{ color: "#c8d8f0" }}>{email.trim()}</span>. Enter it below along with your new password.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* OTP input */}
            <div className="flex flex-col gap-1">
              <label style={{ fontSize: "11px", fontWeight: 500, color: "#4a6080", fontFamily: "Inter", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Verification Code
              </label>
              <input
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                style={{
                  background: "rgba(6,14,30,0.9)", border: err && otp.length !== 6 ? "1px solid rgba(239,68,68,0.55)" : "1px solid rgba(28,50,84,0.9)", borderRadius: "16px",
                  color: "#38bdf8", padding: "16px 20px", fontSize: "28px", fontWeight: 700, fontFamily: "Inter", letterSpacing: "10px",
                  width: "100%", outline: "none", textAlign: "center",
                }}
              />
            </div>

            {/* New password */}
            <Field
              icon={Lock}
              placeholder="New password (min. 8 characters)"
              type={showNewPass ? "text" : "password"}
              value={newPassword}
              onChange={(v) => { setNewPassword(v); setErr(""); }}
              label="New Password"
              error={undefined}
              rightEl={
                <button type="button" onClick={() => setShowNewPass(!showNewPass)}>
                  {showNewPass
                    ? <EyeOff size={15} style={{ color: "#4a6080" }} />
                    : <Eye size={15} style={{ color: "#4a6080" }} />}
                </button>
              }
            />

            {/* Error */}
            <AnimatePresence>
              {err && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-1.5 px-1">
                  <AlertCircle size={12} style={{ color: "#ef4444" }} />
                  <span style={{ fontSize: "12px", color: "#ef4444", fontFamily: "Inter" }}>{err}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: loading ? 1 : 0.97 }}
              onClick={handleVerifyAndReset}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-4"
              style={{ background: loading ? "rgba(14,107,176,0.5)" : "linear-gradient(135deg, #0e6bb0, #0a4f8a)", border: "1px solid rgba(56,189,248,0.3)", color: "#e8f4ff", fontSize: "15px", fontWeight: 600, fontFamily: "Inter", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} style={{ width: 17, height: 17, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTop: "2px solid #e8f4ff" }} />
                  Resetting password…
                </>
              ) : (
                <>Reset Password <ArrowRight size={17} /></>
              )}
            </motion.button>

            {/* Resend */}
            <p style={{ fontSize: "12px", color: "#3a5070", fontFamily: "Inter", textAlign: "center" }}>
              Didn't receive the code?{" "}
              {resendCooldown > 0 ? (
                <span style={{ color: "#2a4060" }}>Resend in {resendCooldown}s</span>
              ) : (
                <button onClick={() => handleSendOtp(true)} style={{ color: "#38bdf8" }}>Resend code</button>
              )}
            </p>
          </div>
        </>
      )}

      {/* Step: Success */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full rounded-2xl p-8 flex flex-col items-center" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(34,197,94,0.15)" }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "#22c55e", fontFamily: "Inter", marginBottom: "10px" }}>
              Password reset!
            </p>
            <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter", lineHeight: 1.6 }}>
              Your password has been successfully updated. Sign in with your new password.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 rounded-xl"
              style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8", fontSize: "14px", fontFamily: "Inter", fontWeight: 500 }}
            >
              Back to Sign In
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────}

// ─── Types ───────────────────────────────────────────────────────────────────

type Errors = {
  name?: string;
  email?: string;
  password?: string;
  terms?: string;
};

// ─── Main component ─────────────────────────────��────────────────────────────

export function AuthScreen() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");

  // fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [terms, setTerms] = useState(false);

  // state
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [globalMsg, setGlobalMsg] = useState("");
  const [globalType, setGlobalType] = useState<"error" | "success" | "info">("error");
  const [shake, setShake] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const switchTab = (t: "login" | "signup") => {
    setTab(t);
    setErrors({});
    setGlobalMsg("");
    setName("");
    setPassword("");
    setTerms(false);
  };

  const clearErr = (field: keyof Errors) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  const validate = (): Errors => {
    const e: Errors = {};
    if (tab === "signup") {
      if (!name.trim()) e.name = "Full name is required.";
      else if (name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    }
    if (!email.trim()) {
      e.email = "Email address is required.";
    } else if (!isValidEmail(email)) {
      e.email = "Enter a valid email address.";
    }
    if (!password) {
      e.password = "Password is required.";
    } else if (tab === "login" && password.length < 6) {
      e.password = "Password must be at least 6 characters.";
    } else if (tab === "signup" && password.length < 8) {
      e.password = "Password must be at least 8 characters.";
    }
    if (tab === "signup" && !terms) {
      e.terms = "You must accept the Terms of Service to continue.";
    }
    return e;
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async () => {
    setGlobalMsg("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      if (tab === "login") {
        const data = await api.signIn(email, password);
        setSession(
          data.session,
          { id: data.user.id, email: data.user.email },
          data.profile
        );
        navigate("/app");
      } else {
        const data = await api.signUp(name, email, password);
        setSession(
          data.session,
          { id: data.user.id, email: data.user.email },
          data.profile
        );
        navigate("/app");
      }
    } catch (err: any) {
      setGlobalMsg(err.message || "Something went wrong. Please try again.");
      setGlobalType("error");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Password strength meter (signup)
  const pwScore = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const pwColors = ["#ef4444", "#f97316", "#f59e0b", "#22c55e"];

  return (
    <div className="relative flex flex-col overflow-y-auto scrollbar-hide px-5 pt-2 pb-10" style={{ height: "100%" }}>

      {/* Forgot password slide-in overlay */}
      <AnimatePresence>
        {showForgot && (
          <ForgotPasswordOverlay onClose={() => setShowForgot(false)} />
        )}
      </AnimatePresence>

      {/* Back */}
      <button
        onClick={() => navigate("/onboarding")}
        className="flex items-center gap-1 mb-6 mt-2"
        style={{ color: "#4a6080", fontSize: "13px", fontFamily: "Inter" }}
      >
        <ChevronLeft size={16} /> Back
      </button>

      {/* Branding */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: "46px", height: "46px",
            background: "linear-gradient(135deg, #0f2a4a, #0a1b30)",
            border: "1.5px solid rgba(56,189,248,0.25)",
            boxShadow: "0 0 22px rgba(56,189,248,0.18)",
          }}
        >
          <Shield size={22} color="#38bdf8" strokeWidth={1.5} />
        </div>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter", letterSpacing: "-0.3px" }}>
            Port<span style={{ color: "#38bdf8" }}>Sentinel</span>
          </div>
          <div style={{ fontSize: "11px", color: "#3a5070", fontFamily: "Inter" }}>Network Security Scanner</div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div
        className="flex rounded-2xl p-1 mb-6"
        style={{ background: "rgba(6,14,30,0.9)", border: "1px solid rgba(28,50,84,0.7)" }}
      >
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className="flex-1 py-2.5 rounded-xl transition-all duration-200"
            style={{
              background: tab === t ? "rgba(56,189,248,0.12)" : "transparent",
              color: tab === t ? "#38bdf8" : "#3a5070",
              fontSize: "13px",
              fontWeight: tab === t ? 600 : 400,
              fontFamily: "Inter",
              border: tab === t ? "1px solid rgba(56,189,248,0.25)" : "1px solid transparent",
            }}
          >
            {t === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      {/* Global banner */}
      <AnimatePresence>
        {globalMsg && (
          <Banner
            type={globalType}
            msg={globalMsg}
            onClose={() => setGlobalMsg("")}
          />
        )}
      </AnimatePresence>

      {/* Form */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: shake ? 0.45 : 0.22 }}
        >
          {/* Heading */}
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter", marginBottom: "4px", letterSpacing: "-0.3px" }}>
              {tab === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>
              {tab === "login"
                ? "Sign in to monitor and secure your network"
                : "Start scanning and securing your network for free"}
            </p>
          </div>

          <div className="flex flex-col gap-3">

            {/* Full name (signup only) */}
            {tab === "signup" && (
              <Field
                icon={User}
                placeholder="Full name"
                value={name}
                onChange={(v) => { setName(v); clearErr("name"); }}
                onFocus={() => clearErr("name")}
                error={errors.name}
              />
            )}

            {/* Email */}
            <Field
              icon={Mail}
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(v) => { setEmail(v); clearErr("email"); }}
              onFocus={() => clearErr("email")}
              error={errors.email}
            />

            {/* Password */}
            <Field
              icon={Lock}
              placeholder={tab === "signup" ? "Create a strong password" : "Password"}
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(v) => { setPassword(v); clearErr("password"); }}
              onFocus={() => clearErr("password")}
              error={errors.password}
              rightEl={
                <button type="button" onClick={() => setShowPass(!showPass)}>
                  {showPass
                    ? <EyeOff size={15} style={{ color: "#4a6080" }} />
                    : <Eye size={15} style={{ color: "#4a6080" }} />}
                </button>
              }
            />

            {/* Password strength meter (signup only) */}
            <AnimatePresence>
              {tab === "signup" && password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 px-0.5"
                >
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-all duration-300"
                      style={{
                        height: "3px",
                        background: i <= pwScore
                          ? pwColors[pwScore - 1]
                          : "rgba(28,50,84,0.5)",
                      }}
                    />
                  ))}
                  <span style={{
                    fontSize: "10px",
                    color: pwScore > 0 ? pwColors[pwScore - 1] : "#3a5070",
                    fontFamily: "Inter",
                    marginLeft: 4,
                    minWidth: 36,
                    textAlign: "right",
                  }}>
                    {pwLabels[pwScore]}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forgot password (login only) */}
            {tab === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  style={{ fontSize: "12px", color: "#38bdf8", fontFamily: "Inter" }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Terms checkbox (signup only) */}
            {tab === "signup" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-start gap-2.5 mt-1">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={terms}
                    onChange={(e) => { setTerms(e.target.checked); clearErr("terms"); }}
                    style={{ marginTop: "2px", accentColor: "#38bdf8", flexShrink: 0, width: 15, height: 15 }}
                  />
                  <label
                    htmlFor="terms"
                    style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter", lineHeight: 1.55 }}
                  >
                    I agree to the{" "}
                    <span style={{ color: "#38bdf8" }}>Terms of Service</span> and{" "}
                    <span style={{ color: "#38bdf8" }}>Privacy Policy</span>
                  </label>
                </div>
                <AnimatePresence>
                  {errors.terms && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-1.5 px-1"
                    >
                      <AlertCircle size={11} style={{ color: "#ef4444" }} />
                      <span style={{ fontSize: "11px", color: "#ef4444", fontFamily: "Inter" }}>{errors.terms}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Submit button */}
            <motion.button
              whileTap={{ scale: loading ? 1 : 0.97 }}
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 mt-1"
              style={{
                background: loading
                  ? "rgba(14,107,176,0.45)"
                  : "linear-gradient(135deg, #0e6bb0, #0a4f8a)",
                border: "1px solid rgba(56,189,248,0.3)",
                color: "#e8f4ff",
                fontSize: "15px",
                fontWeight: 600,
                fontFamily: "Inter",
                boxShadow: loading ? "none" : "0 4px 22px rgba(56,189,248,0.2)",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
                    style={{
                      width: 17, height: 17, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.2)",
                      borderTop: "2px solid #e8f4ff",
                    }}
                  />
                  {tab === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>
                  {tab === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight size={17} />
                </>
              )}
            </motion.button>

            {/* Switch tab link */}
            <p style={{ textAlign: "center", fontSize: "13px", color: "#3a5070", fontFamily: "Inter", marginTop: "4px" }}>
              {tab === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button onClick={() => switchTab("signup")} style={{ color: "#38bdf8", fontWeight: 500 }}>
                    Sign up free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => switchTab("login")} style={{ color: "#38bdf8", fontWeight: 500 }}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer */}
      <div className="mt-auto pt-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
          <span style={{ fontSize: "11px", color: "#2a4060", fontFamily: "Inter" }}>
            All connections encrypted with TLS 1.3
          </span>
        </div>
        <p style={{ fontSize: "11px", color: "#1e3050", fontFamily: "Inter", textAlign: "center", lineHeight: 1.6 }}>
          © 2026 PortSentinel. Built for security professionals.
        </p>
      </div>
    </div>
  );
}
