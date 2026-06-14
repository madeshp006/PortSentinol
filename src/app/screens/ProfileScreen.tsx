import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Bell, Shield, Globe, ChevronRight,
  LogOut, Lock, Wifi, MessageCircle, HelpCircle,
  Edit3, Check, X, Eye, EyeOff, Fingerprint,
  Terminal, Activity, Radar, AlertTriangle,
  Key, Smartphone, CheckCircle, RefreshCw,
  Star, Copy, ChevronDown,
} from "lucide-react";
import { safeCopy } from "../utils/clipboard";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

// ─── Toggle ──────────────────────────────────────────────────────────────────

const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className="rounded-full transition-all duration-200 shrink-0"
    style={{
      width: "42px", height: "24px",
      background: enabled ? "rgba(56,189,248,0.25)" : "rgba(28,50,84,0.5)",
      border: enabled ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(28,50,84,0.7)",
      position: "relative",
    }}
  >
    <motion.div
      className="rounded-full absolute"
      style={{
        width: "16px", height: "16px", top: "3px",
        background: enabled ? "linear-gradient(135deg,#38bdf8,#06b6d4)" : "#2a3f5e",
        boxShadow: enabled ? "0 0 8px rgba(56,189,248,0.6)" : "none",
      }}
      animate={{ left: enabled ? "22px" : "3px" }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    />
  </button>
);

// ─── Animated avatar ─────────────────────────────────────────────────────────

const CyberAvatar = ({ editing }: { editing: boolean }) => (
  <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{ border: "1.5px solid rgba(56,189,248,0.25)" }}
      animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.1, 0.4] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute rounded-full"
      style={{ inset: "8px", border: "1px solid rgba(56,189,248,0.35)" }}
      animate={{ rotate: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    />
    <motion.div
      className="absolute rounded-full"
      style={{
        inset: "8px",
        background: "conic-gradient(from 0deg, rgba(56,189,248,0.0) 0%, rgba(56,189,248,0.18) 30%, rgba(56,189,248,0.0) 60%)",
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
    />
    <div
      className="relative flex items-center justify-center rounded-full z-10"
      style={{
        width: 52, height: 52,
        background: "linear-gradient(135deg,rgba(56,189,248,0.18),rgba(59,130,246,0.1))",
        border: editing ? "1.5px solid rgba(56,189,248,0.7)" : "1.5px solid rgba(56,189,248,0.35)",
        boxShadow: editing ? "0 0 18px rgba(56,189,248,0.35)" : "0 0 12px rgba(56,189,248,0.15)",
        transition: "border 0.3s, box-shadow 0.3s",
      }}
    >
      <User size={24} style={{ color: "#38bdf8" }} strokeWidth={1.6} />
      {editing && (
        <motion.div
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          style={{ width: 18, height: 18, background: "#38bdf8", border: "2px solid #070d1e" }}
        >
          <Edit3 size={9} style={{ color: "#070d1e" }} strokeWidth={2.5} />
        </motion.div>
      )}
    </div>
  </div>
);

// ─── OTP single-digit input (uses callback ref for reliable focus) ────────────

const OtpDigit = ({
  value,
  onChange,
  onKeyDown,
  onRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRef: (el: HTMLInputElement | null) => void;
}) => (
  <input
    ref={onRef}                          // ← callback ref: sets DOM node directly in array
    type="text"
    inputMode="numeric"
    maxLength={1}
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/\D/, ""))}
    onKeyDown={onKeyDown}               // ← handles Backspace navigation
    className="text-center rounded-xl transition-all duration-200"
    style={{
      width: 42, height: 50,
      background: value ? "rgba(56,189,248,0.1)" : "rgba(10,20,40,0.8)",
      border: value ? "1.5px solid rgba(56,189,248,0.6)" : "1.5px solid rgba(28,50,84,0.7)",
      color: "#38bdf8", fontSize: "20px", fontFamily: "monospace", fontWeight: 700,
      outline: "none",
      boxShadow: value ? "0 0 0 3px rgba(56,189,248,0.1)" : "none",
    }}
  />
);

// ─── Main screen ──────────────────────────────────────────────────────────────

type PwStep = "idle" | "form" | "otp" | "success";

export function ProfileScreen() {
  const navigate = useNavigate();
  const { token, user, logout, profile: authProfile, setProfile: setAuthProfile } = useAuth();

  // ── profile (load from backend)
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState(() =>
    authProfile
      ? { name: authProfile.name, email: authProfile.email, role: authProfile.role || "Security Analyst" }
      : { name: "", email: "", role: "Security Analyst" }
  );
  const [draft, setDraft] = useState(profile);
  const [profileLoading, setProfileLoading] = useState(!authProfile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── real stats from backend
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [threatsFound, setThreatsFound] = useState<number | null>(null);

  // ── support modals
  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState<"bug" | "feature" | "general">("general");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  // ── copy operator ID
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    // If profile already cached in AuthContext, use it immediately
    if (authProfile) {
      const loaded = {
        name: authProfile.name || user?.email?.split("@")[0] || "Operator",
        email: authProfile.email || user?.email || "",
        role: authProfile.role || "Security Analyst",
      };
      setProfile(loaded);
      // NOTE: do NOT call setDraft here — user may already be in edit mode typing
      setProfileLoading(false);
    } else {
      // Fetch from API
      api.getProfile(token)
        .then((p) => {
          const loaded = {
            name: p.name || user?.email?.split("@")[0] || "Operator",
            email: p.email || user?.email || "",
            role: p.role || "Security Analyst",
          };
          setProfile(loaded);
          // NOTE: do NOT call setDraft here — user may already be in edit mode typing
          setAuthProfile(p); // cache in context for other screens
        })
        .catch((e) => console.log("Load profile error:", e.message))
        .finally(() => setProfileLoading(false));
    }

    // Load scans to compute real stats
    api.getScans(token)
      .then((scans: any[]) => {
        setScanCount(scans.length);
        const threats = scans.reduce((sum: number, s: any) => {
          const ports: any[] = s.ports ?? [];
          return sum + ports.filter((p) => p.risk === "critical" || p.risk === "high").length;
        }, 0);
        setThreatsFound(threats);
      })
      .catch((e) => console.log("Load scans for stats error:", e.message));
  }, [token]);

  // Sync if authProfile gets updated externally (e.g. after Dashboard loads it)
  useEffect(() => {
    if (authProfile && profileLoading) {
      const loaded = {
        name: authProfile.name || "Operator",
        email: authProfile.email || "",
        role: authProfile.role || "Security Analyst",
      };
      setProfile(loaded);
      // NOTE: do NOT call setDraft — user may be typing in edit mode
      setProfileLoading(false);
    }
  }, [authProfile]);

  const saveProfile = async () => {
    if (!token) return;
    const trimmedName = draft.name.trim();
    const trimmedRole = draft.role.trim();
    if (!trimmedName) { setSaveError("Name cannot be empty."); return; }
    setSavingProfile(true);
    setSaveError("");
    try {
      const updated = await api.updateProfile(token, { name: trimmedName, role: trimmedRole });
      const loaded = {
        name: updated.name || trimmedName,
        email: updated.email || profile.email,
        role: updated.role || trimmedRole,
      };
      setProfile(loaded);
      setDraft(loaded);
      setAuthProfile(updated); // keep context in sync
      setEditMode(false);
    } catch (e: any) {
      console.log("Save profile error:", e.message);
      setSaveError(e.message || "Failed to save. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── preferences
  const [settings, setSettings] = useState({
    notifications: true, criticalAlerts: true,
    autoScan: false, darkMode: true,
    scanHistory: true, biometric: false,
  });
  const toggle = (k: keyof typeof settings) => setSettings(p => ({ ...p, [k]: !p[k] }));

  // ── password change flow
  const [pwStep, setPwStep] = useState<PwStep>("idle");
  const [pwForm, setPwForm] = useState({ old: "", newPw: "", confirm: "" });
  const [showPw, setShowPw] = useState({ old: false, newPw: false, confirm: false });
  const [pwError, setPwError] = useState("");

  // ── OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpError, setOtpError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  // Plain mutable array — callback refs write directly into this
  const otpRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── terminal log
  const logLines = [
    { ts: "04:02:11", msg: "Session authenticated — operator verified", c: "#22c55e" },
    { ts: "03:58:44", msg: "Scan completed: 192.168.1.0/24", c: "#38bdf8" },
    { ts: "03:55:12", msg: "High-risk port 445 flagged on host .105", c: "#f97316" },
    { ts: "03:41:07", msg: "PDF report exported successfully", c: "#a78bfa" },
    { ts: "03:30:00", msg: "Scheduled scan triggered: Daily sweep", c: "#38bdf8" },
  ];

  // Start/stop countdown when entering OTP step
  useEffect(() => {
    if (pwStep === "otp") {
      setOtpTimer(60);
      timerRef.current = setInterval(() => {
        setOtpTimer(t => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pwStep]);

  // Auto-focus first OTP box when step becomes "otp"
  useEffect(() => {
    if (pwStep === "otp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [pwStep]);

  // ── OTP handlers
  const handleOtpChange = (idx: number, val: string) => {
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    // Move forward on digit entry
    if (val && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (otp[idx]) {
        // Clear current box
        const next = [...otp];
        next[idx] = "";
        setOtp(next);
      } else if (idx > 0) {
        // Move to previous box
        otpRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  // ── password form submit
  // ── Send OTP (verifies old password on server, then emails the code)
  const submitPwForm = async () => {
    setPwError("");
    if (!pwForm.old) return setPwError("Enter your current password.");
    if (pwForm.newPw.length < 8) return setPwError("New password must be at least 8 characters.");
    if (pwForm.newPw !== pwForm.confirm) return setPwError("Passwords don't match.");
    if (!token) return setPwError("Session expired. Please sign in again.");
    setSendingOtp(true);
    try {
      const res = await api.sendOtp(token, pwForm.old);
      setOtpEmail(res.email || "your email");
      setOtp(["", "", "", "", "", ""]);
      setPwStep("otp");
    } catch (e: any) {
      console.log("Send OTP error:", e.message);
      setPwError(e.message || "Failed to send verification code. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  // ── Resend OTP (calls sendOtp again using same old password still in pwForm)
  const resendOtp = async () => {
    if (!token) return;
    setSendingOtp(true);
    setOtpError("");
    try {
      const res = await api.sendOtp(token, pwForm.old);
      setOtpEmail(res.email || otpEmail);
      setOtp(["", "", "", "", "", ""]);
      setOtpTimer(60);
    } catch (e: any) {
      console.log("Resend OTP error:", e.message);
      setOtpError(e.message || "Failed to resend code.");
    } finally {
      setSendingOtp(false);
    }
  };

  // ── OTP verify + change password
  const submitOtp = async () => {
    setOtpError("");
    const entered = otp.join("");
    if (entered.length < 6) return setOtpError("Enter the full 6-digit code.");
    if (!token) return setOtpError("Session expired. Please sign in again.");
    setVerifyingOtp(true);
    try {
      await api.changePassword(token, entered, pwForm.newPw);
      setPwStep("success");
    } catch (e: any) {
      console.log("Change password error:", e.message);
      setOtpError(e.message || "Verification failed. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── reset entire flow
  const resetPw = () => {
    setPwStep("idle");
    setPwForm({ old: "", newPw: "", confirm: "" });
    setOtp(["", "", "", "", "", ""]);
    setPwError("");
    setOtpError("");
    setOtpEmail("");
    setSendingOtp(false);
    setVerifyingOtp(false);
  };

  const operatorId = user?.id
    ? `OPR-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
    : "OPR-XXXXXXXX";
  const clearanceColor = "#a78bfa";

  // Password strength score
  const pwScore = Math.min(4, Math.floor(pwForm.newPw.length / 3));
  const pwStrengthLabel = ["", "Weak", "Fair", "Good", "Strong"][pwScore];
  const pwStrengthColors = ["#ef4444", "#f97316", "#f59e0b", "#22c55e"];

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ background: "transparent" }}>
      <div className="flex-1 overflow-y-auto pb-4" style={{ scrollbarWidth: "none" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div>
            <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", letterSpacing: "1px", textTransform: "uppercase" }}>PortSentinel</p>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter", letterSpacing: "-0.3px" }}>Operator Profile</h2>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
            style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <Shield size={11} style={{ color: clearanceColor }} />
            <span style={{ fontSize: "10px", color: clearanceColor, fontFamily: "monospace", letterSpacing: "0.5px" }}>CLEARANCE L3</span>
          </div>
        </div>

        {/* ── Operator ID card ────────────────────────────────────────────── */}
        <motion.div className="mx-5 rounded-2xl overflow-hidden mb-4" layout
          style={{ background: "linear-gradient(135deg,#0a1628,#061020)", border: "1px solid rgba(28,50,84,0.8)" }}>
          <div className="h-1.5" style={{ background: "linear-gradient(90deg,#38bdf8,#3b82f6,#a78bfa)" }} />
          <div className="p-4">
            <div className="flex items-start gap-4">
              <CyberAvatar editing={editMode} />
              <div className="flex-1 min-w-0">
                <AnimatePresence mode="wait">
                  {editMode ? (
                    <motion.div key="edit" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="flex flex-col gap-2">
                      {/* Name — editable */}
                      <div>
                        <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>Display Name</p>
                        <input
                          autoFocus
                          value={draft.name}
                          onChange={e => { setDraft(p => ({ ...p, name: e.target.value })); setSaveError(""); }}
                          placeholder="Your name"
                          style={{
                            background: "rgba(10,20,40,0.8)", border: draft.name.trim() ? "1px solid rgba(56,189,248,0.45)" : "1px solid rgba(239,68,68,0.4)",
                            borderRadius: 8, padding: "6px 10px", color: "#e8f0fe", fontSize: "14px",
                            fontWeight: 700, fontFamily: "Inter", outline: "none", width: "100%",
                          }}
                        />
                      </div>
                      {/* Role — editable */}
                      <div>
                        <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>Role / Title</p>
                        <input
                          value={draft.role}
                          onChange={e => setDraft(p => ({ ...p, role: e.target.value }))}
                          placeholder="Security Analyst"
                          style={{
                            background: "rgba(10,20,40,0.8)", border: "1px solid rgba(56,189,248,0.35)",
                            borderRadius: 8, padding: "6px 10px", color: "#a78bfa", fontSize: "11px",
                            fontFamily: "Inter", outline: "none", width: "100%",
                          }}
                        />
                      </div>
                      {/* Email — read-only */}
                      <div>
                        <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>Email (read-only)</p>
                        <input
                          readOnly
                          value={draft.email}
                          style={{
                            background: "rgba(10,20,40,0.4)", border: "1px solid rgba(28,50,84,0.4)",
                            borderRadius: 8, padding: "6px 10px", color: "#3a5070", fontSize: "12px",
                            fontFamily: "Inter", outline: "none", width: "100%", cursor: "default",
                          }}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <p style={{ fontSize: "16px", fontWeight: 700, color: profileLoading ? "#2a3f5e" : "#e8f0fe", fontFamily: "Inter", lineHeight: 1.2 }}>
                        {profileLoading ? "Loading…" : (profile.name || user?.email?.split("@")[0] || "Operator")}
                      </p>
                      <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter", marginTop: 2 }}>
                        {profile.email || user?.email || ""}
                      </p>
                      <p style={{ fontSize: "11px", color: "#a78bfa", fontFamily: "Inter", marginTop: 2 }}>{profile.role}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2 mt-2.5">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{ background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.15)" }}>
                    <Terminal size={9} style={{ color: "#38bdf8" }} />
                    <span style={{ fontSize: "9px", color: "#38bdf8", fontFamily: "monospace" }}>{operatorId}</span>
                  </div>
                  <span className="px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", fontSize: "9px", fontFamily: "Inter" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                    ONLINE
                  </span>
                  <span className="px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)", color: "#a78bfa", fontSize: "9px", fontFamily: "Inter" }}>
                    <Star size={8} fill="currentColor" /> Pro
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
              {saveError ? (
                <p style={{ fontSize: "11px", color: "#ef4444", fontFamily: "Inter", textAlign: "center" }}>{saveError}</p>
              ) : null}
              <div className="flex gap-2">
              {editMode ? (
                <>
                  <motion.button
                    whileTap={savingProfile ? {} : { scale: 0.97 }}
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl"
                    style={{
                      background: savingProfile ? "rgba(28,50,84,0.4)" : "linear-gradient(135deg,rgba(56,189,248,0.2),rgba(59,130,246,0.15))",
                      border: "1px solid rgba(56,189,248,0.4)",
                      color: savingProfile ? "#3a5070" : "#38bdf8",
                      fontSize: "12px", fontFamily: "Inter", fontWeight: 600,
                    }}>
                    {savingProfile
                      ? <><RefreshCw size={12} className="animate-spin" /> Saving…</>
                      : <><Check size={13} /> Save Changes</>}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setDraft(profile); setEditMode(false); setSaveError(""); }}
                    className="flex items-center justify-center py-2 px-4 rounded-xl"
                    style={{ background: "rgba(28,50,84,0.5)", border: "1px solid rgba(28,50,84,0.8)", color: "#4a6080" }}>
                    <X size={13} />
                  </motion.button>
                </>
              ) : (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setDraft(profile); setEditMode(true); setSaveError(""); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl"
                  style={{ background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "12px", fontFamily: "Inter", fontWeight: 500 }}>
                  <Edit3 size={12} /> Edit Profile
                </motion.button>
              )}
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3" style={{ borderTop: "1px solid rgba(28,50,84,0.6)" }}>
            {[
              { label: "Scans Run", value: scanCount !== null ? scanCount.toString() : "—", icon: Radar, color: "#38bdf8" },
              { label: "Threats Found", value: threatsFound !== null ? threatsFound.toString() : "—", icon: AlertTriangle, color: "#f97316" },
              { label: "Uptime", value: "99.8%", icon: Activity, color: "#22c55e" },
            ].map((s, i) => (
              <div key={s.label} className="flex flex-col items-center py-3 gap-0.5"
                style={{ borderRight: i < 2 ? "1px solid rgba(28,50,84,0.5)" : "none" }}>
                <s.icon size={13} style={{ color: s.color, marginBottom: 2 }} />
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>{s.value}</p>
                <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Security section ────────────────────────────────────────────── */}
        <div className="px-5 mb-4">
          <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Security
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>

            {/* Change Password toggle row */}
            <button className="w-full flex items-center gap-3 px-4 py-3.5"
              onClick={() => setPwStep(p => p === "idle" ? "form" : "idle")}>
              <div className="flex items-center justify-center rounded-xl"
                style={{ width: 34, height: 34, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", flexShrink: 0 }}>
                <Key size={15} style={{ color: "#fbbf24" }} />
              </div>
              <div className="flex-1 text-left">
                <p style={{ fontSize: "13px", color: "#c8d8f0", fontFamily: "Inter" }}>Change Password</p>
                <p style={{ fontSize: "10px", color: "#3a5070", fontFamily: "Inter" }}>OTP verification required</p>
              </div>
              <motion.div animate={{ rotate: pwStep !== "idle" ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={15} style={{ color: "#3a5070" }} />
              </motion.div>
            </button>

            {/* Collapsible panel */}
            <AnimatePresence initial={false}>
              {pwStep !== "idle" && (
                <motion.div key="pwpanel"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }}
                  style={{ overflow: "hidden", borderTop: "1px solid rgba(28,50,84,0.5)" }}>
                  <div className="px-4 py-4">
                    <AnimatePresence mode="wait">

                      {/* STEP 1 — password fields */}
                      {pwStep === "form" && (
                        <motion.div key="form"
                          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                          className="flex flex-col gap-3">

                          {/* Current password */}
                          <div>
                            <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginBottom: 5, letterSpacing: "0.6px", textTransform: "uppercase" }}>Current Password</p>
                            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                              style={{ background: "rgba(10,20,40,0.9)", border: "1px solid rgba(28,50,84,0.7)" }}>
                              <Lock size={13} style={{ color: "#3a5070" }} />
                              <input type={showPw.old ? "text" : "password"} value={pwForm.old}
                                onChange={e => setPwForm(p => ({ ...p, old: e.target.value }))}
                                placeholder="Enter current password"
                                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#c8d8f0", fontSize: "13px", fontFamily: "Inter" }} />
                              <button type="button" onClick={() => setShowPw(p => ({ ...p, old: !p.old }))}>
                                {showPw.old ? <EyeOff size={13} style={{ color: "#3a5070" }} /> : <Eye size={13} style={{ color: "#3a5070" }} />}
                              </button>
                            </div>
                          </div>

                          {/* New password */}
                          <div>
                            <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginBottom: 5, letterSpacing: "0.6px", textTransform: "uppercase" }}>New Password</p>
                            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                              style={{ background: "rgba(10,20,40,0.9)", border: "1px solid rgba(28,50,84,0.7)" }}>
                              <Lock size={13} style={{ color: "#3a5070" }} />
                              <input type={showPw.newPw ? "text" : "password"} value={pwForm.newPw}
                                onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                                placeholder="Min 8 characters"
                                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#c8d8f0", fontSize: "13px", fontFamily: "Inter" }} />
                              <button type="button" onClick={() => setShowPw(p => ({ ...p, newPw: !p.newPw }))}>
                                {showPw.newPw ? <EyeOff size={13} style={{ color: "#3a5070" }} /> : <Eye size={13} style={{ color: "#3a5070" }} />}
                              </button>
                            </div>
                            {pwForm.newPw.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5">
                                {[1, 2, 3, 4].map(i => (
                                  <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                                    style={{ background: i <= pwScore ? pwStrengthColors[pwScore - 1] : "rgba(28,50,84,0.5)" }} />
                                ))}
                                <span style={{ fontSize: "9px", color: pwScore > 0 ? pwStrengthColors[pwScore - 1] : "#3a5070", fontFamily: "Inter", marginLeft: 4, minWidth: 32 }}>
                                  {pwStrengthLabel}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Confirm password */}
                          <div>
                            <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginBottom: 5, letterSpacing: "0.6px", textTransform: "uppercase" }}>Confirm New Password</p>
                            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                              style={{
                                background: "rgba(10,20,40,0.9)",
                                border: pwForm.confirm
                                  ? pwForm.confirm === pwForm.newPw
                                    ? "1px solid rgba(34,197,94,0.5)"
                                    : "1px solid rgba(239,68,68,0.5)"
                                  : "1px solid rgba(28,50,84,0.7)",
                              }}>
                              <Lock size={13} style={{ color: "#3a5070" }} />
                              <input type={showPw.confirm ? "text" : "password"} value={pwForm.confirm}
                                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                                placeholder="Re-enter new password"
                                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#c8d8f0", fontSize: "13px", fontFamily: "Inter" }} />
                              {pwForm.confirm && pwForm.confirm === pwForm.newPw
                                ? <Check size={13} style={{ color: "#22c55e" }} />
                                : (
                                  <button type="button" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}>
                                    {showPw.confirm ? <EyeOff size={13} style={{ color: "#3a5070" }} /> : <Eye size={13} style={{ color: "#3a5070" }} />}
                                  </button>
                                )}
                            </div>
                          </div>

                          {pwError && <p style={{ fontSize: "11px", color: "#ef4444", fontFamily: "Inter" }}>{pwError}</p>}

                          <div className="flex gap-2 mt-1">
                            <motion.button whileTap={{ scale: 0.97 }} onClick={submitPwForm}
                              disabled={sendingOtp}
                              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                              style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.15))", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", fontSize: "12px", fontFamily: "Inter", fontWeight: 600, opacity: sendingOtp ? 0.6 : 1 }}>
                              {sendingOtp
                                ? <><RefreshCw size={13} className="animate-spin" /> Sending…</>
                                : <><Smartphone size={13} /> Send Code via Email</>}
                            </motion.button>
                            <button type="button" onClick={resetPw} className="px-3 py-2.5 rounded-xl"
                              style={{ background: "rgba(28,50,84,0.3)", border: "1px solid rgba(28,50,84,0.6)", color: "#3a5070" }}>
                              <X size={13} />
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 2 — OTP verification */}
                      {pwStep === "otp" && (
                        <motion.div key="otp"
                          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                          className="flex flex-col items-center gap-4">

                          <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center justify-center rounded-full"
                              style={{ width: 48, height: 48, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)" }}>
                              <Smartphone size={22} style={{ color: "#38bdf8" }} strokeWidth={1.5} />
                            </div>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>Verify Your Identity</p>
                            <p style={{ fontSize: "11px", color: "#3a5070", fontFamily: "Inter", textAlign: "center" }}>
                              A 6-digit code was sent to{" "}
                              <span style={{ color: "#38bdf8" }}>{otpEmail}</span>
                            </p>
                          </div>

                          {/* 6 OTP boxes — uses callback ref (onRef) so focus() works */}
                          <div className="flex items-center gap-2">
                            {otp.map((digit, i) => (
                              <OtpDigit
                                key={i}
                                value={digit}
                                onRef={(el) => { otpRefs.current[i] = el; }}
                                onChange={(v) => handleOtpChange(i, v)}
                                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                              />
                            ))}
                          </div>

                          {otpError && <p style={{ fontSize: "11px", color: "#ef4444", fontFamily: "Inter" }}>{otpError}</p>}

                          <div className="flex items-center gap-2">
                            {otpTimer > 0 ? (
                              <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
                                Expires in{" "}
                                <span style={{ color: otpTimer < 15 ? "#ef4444" : "#38bdf8", fontFamily: "monospace" }}>
                                  0:{otpTimer.toString().padStart(2, "0")}
                                </span>
                              </p>
                            ) : (
                              <button className="flex items-center gap-1.5"
                                onClick={resendOtp}
                                disabled={sendingOtp}
                                style={{ color: sendingOtp ? "#3a5070" : "#38bdf8", fontSize: "11px", fontFamily: "Inter" }}>
                                <RefreshCw size={11} className={sendingOtp ? "animate-spin" : ""} />
                                {sendingOtp ? "Sending…" : "Resend Code"}
                              </button>
                            )}
                          </div>

                          <div className="flex gap-2 w-full">
                            <motion.button whileTap={{ scale: 0.97 }} onClick={submitOtp}
                              disabled={verifyingOtp}
                              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                              style={{ background: "linear-gradient(135deg,rgba(56,189,248,0.25),rgba(59,130,246,0.18))", border: "1px solid rgba(56,189,248,0.45)", color: "#38bdf8", fontSize: "13px", fontFamily: "Inter", fontWeight: 600, opacity: verifyingOtp ? 0.6 : 1 }}>
                              {verifyingOtp
                                ? <><RefreshCw size={14} className="animate-spin" /> Verifying…</>
                                : <><Shield size={14} /> Verify & Update</>}
                            </motion.button>
                            <button onClick={() => setPwStep("form")} className="px-3 py-2.5 rounded-xl"
                              style={{ background: "rgba(28,50,84,0.3)", border: "1px solid rgba(28,50,84,0.6)", color: "#4a6080", fontSize: "12px", fontFamily: "Inter" }}>
                              Back
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 3 — success */}
                      {pwStep === "success" && (
                        <motion.div key="success"
                          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                          className="flex flex-col items-center gap-3 py-2">
                          <motion.div
                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 18 }}
                            className="flex items-center justify-center rounded-full"
                            style={{ width: 56, height: 56, background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.4)", boxShadow: "0 0 24px rgba(34,197,94,0.2)" }}>
                            <CheckCircle size={28} style={{ color: "#22c55e" }} strokeWidth={1.5} />
                          </motion.div>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#22c55e", fontFamily: "Inter" }}>Password Updated!</p>
                          <p style={{ fontSize: "11px", color: "#3a5070", fontFamily: "Inter", textAlign: "center" }}>
                            Your password has been changed. All other sessions have been invalidated.
                          </p>
                          <motion.button whileTap={{ scale: 0.97 }} onClick={resetPw}
                            className="px-6 py-2 rounded-xl mt-1"
                            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontSize: "12px", fontFamily: "Inter", fontWeight: 600 }}>
                            Done
                          </motion.button>
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Biometric row */}
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid rgba(28,50,84,0.5)" }}>
              <div className="flex items-center justify-center rounded-xl"
                style={{ width: 34, height: 34, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", flexShrink: 0 }}>
                <Fingerprint size={15} style={{ color: "#38bdf8" }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: "13px", color: "#c8d8f0", fontFamily: "Inter" }}>Biometric Login</p>
                <p style={{ fontSize: "10px", color: "#3a5070", fontFamily: "Inter" }}>Face ID / Fingerprint unlock</p>
              </div>
              <Toggle enabled={settings.biometric} onToggle={() => toggle("biometric")} />
            </div>
          </div>
        </div>

        {/* ── Preferences ─────────────────────────────────────────────────── */}
        {[
          {
            title: "Notifications",
            items: [
              { key: "notifications", label: "Push Notifications", icon: Bell, desc: "Alert on scan results", color: "#38bdf8" },
              { key: "criticalAlerts", label: "Critical Alerts", icon: Shield, desc: "Immediate high-risk alerts", color: "#ef4444" },
            ],
          },
          {
            title: "Scanning",
            items: [
              { key: "autoScan", label: "Auto-Scan on Login", icon: Wifi, desc: "Re-scan last known target", color: "#22c55e" },
              { key: "scanHistory", label: "Save Scan History", icon: Globe, desc: "Persist all scan logs", color: "#a78bfa" },
            ],
          },
        ].map(group => (
          <div key={group.title} className="px-5 mb-4">
            <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
              {group.title}
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(28,50,84,0.7)", background: "rgba(10,20,40,0.7)" }}>
              {group.items.map((item, i) => (
                <div key={item.key} className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: i < group.items.length - 1 ? "1px solid rgba(28,50,84,0.5)" : "none" }}>
                  <div className="flex items-center justify-center rounded-xl"
                    style={{ width: 34, height: 34, background: `${item.color}10`, border: `1px solid ${item.color}25`, flexShrink: 0 }}>
                    <item.icon size={15} style={{ color: item.color }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ fontSize: "13px", color: "#c8d8f0", fontFamily: "Inter" }}>{item.label}</p>
                    <p style={{ fontSize: "10px", color: "#3a5070", fontFamily: "Inter" }}>{item.desc}</p>
                  </div>
                  <Toggle
                    enabled={settings[item.key as keyof typeof settings] as boolean}
                    onToggle={() => toggle(item.key as keyof typeof settings)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* ── Agent Management ────────────────────────────────────────────── */}
        <div className="px-5 mb-4">
          <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Agent Management
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(28,50,84,0.7)", background: "rgba(10,20,40,0.7)" }}>
            <button onClick={() => navigate("/app/agents")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <div className="flex items-center justify-center rounded-xl"
                style={{ width: 34, height: 34, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", flexShrink: 0 }}>
                <Terminal size={15} style={{ color: "#38bdf8" }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: "13px", color: "#c8d8f0", fontFamily: "Inter" }}>PortSentinel Agents</p>
                <p style={{ fontSize: "10px", color: "#3a5070", fontFamily: "Inter" }}>Manage local scanning nodes</p>
              </div>
              <ChevronRight size={14} style={{ color: "#3a5070" }} />
            </button>
          </div>
        </div>

        {/* ── Terminal activity log ────────────────────────────────────────── */}
        <div className="px-5 mb-4">
          <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Recent Activity
          </p>
          <div className="rounded-2xl p-3"
            style={{ background: "rgba(4,8,18,0.9)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <div className="flex items-center gap-1.5 mb-3">
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ marginLeft: 8, fontSize: "9px", color: "#1e3a5f", fontFamily: "monospace" }}>portsentinel — operator@session:~$</span>
            </div>
            {logLines.map((l, i) => (
              <motion.div key={i} className="flex items-start gap-2 mb-1.5"
                initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}>
                <span style={{ fontSize: "9px", color: "#1e3a5f", flexShrink: 0, fontFamily: "monospace" }}>[{l.ts}]</span>
                <span style={{ fontSize: "9px", color: l.c, lineHeight: 1.4, fontFamily: "monospace" }}>{l.msg}</span>
              </motion.div>
            ))}
            <motion.span style={{ fontSize: "9px", color: "#38bdf8", fontFamily: "monospace" }}
              animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}>▋</motion.span>
          </div>
        </div>

        {/* ── Support ──────────────────────────────────────────────────────── */}
        <div className="px-5 mb-4">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(28,50,84,0.7)", background: "rgba(10,20,40,0.7)" }}>
            {[
              { icon: HelpCircle, label: "Help & Documentation", color: "#38bdf8", action: () => setShowHelp(true) },
              { icon: MessageCircle, label: "Send Feedback", color: "#a78bfa", action: () => setShowFeedback(true) },
              { icon: copied ? Check : Copy, label: copied ? "Copied!" : "Copy Operator ID", color: copied ? "#22c55e" : "#4a6080", action: () => { safeCopy(operatorId); setCopied(true); setTimeout(() => setCopied(false), 2000); } },
            ].map((item, i) => (
              <button key={item.label} onClick={item.action}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                style={{ borderBottom: i < 2 ? "1px solid rgba(28,50,84,0.5)" : "none" }}>
                <div className="flex items-center justify-center rounded-xl"
                  style={{ width: 34, height: 34, background: `${item.color}10`, border: `1px solid ${item.color}20`, flexShrink: 0 }}>
                  <item.icon size={15} style={{ color: item.color }} />
                </div>
                <span style={{ flex: 1, fontSize: "13px", color: "#8899b8", fontFamily: "Inter" }}>{item.label}</span>
                <ChevronRight size={14} style={{ color: "#3a5070" }} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Sign out ─────────────────────────────────────────────────────── */}
        <div className="px-5">
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => { logout(); navigate("/auth"); }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "13px", fontFamily: "Inter", fontWeight: 600 }}>
            <LogOut size={15} /> Sign Out of Session
          </motion.button>
          <p style={{ fontSize: "10px", color: "#1a2d4d", fontFamily: "monospace", textAlign: "center", marginTop: 10 }}>
            PortSentinel v1.0.0 · {operatorId} · © 2026
          </p>
        </div>

      </div>

      {/* ── Help & Documentation Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 overflow-y-auto"
            style={{ background: "#060e1e", zIndex: 50, scrollbarWidth: "none" }}
          >
            <div className="px-5 pt-5 pb-10">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setShowHelp(false)}
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 36, height: 36, background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)", flexShrink: 0 }}>
                  <X size={16} style={{ color: "#8899b8" }} />
                </button>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Help & Documentation</h2>
                  <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>PortSentinel v1.0.0</p>
                </div>
              </div>

              {[
                {
                  title: "What is PortSentinel?",
                  icon: Shield,
                  color: "#38bdf8",
                  body: ["PortSentinel is a real TCP port and service misconfiguration scanner.", "It connects to your target host from the cloud, checks which ports are open, and maps them to known CVEs and best-practice fixes."],
                },
                {
                  title: "How to Run a Scan",
                  icon: Radar,
                  color: "#22c55e",
                  body: ["1. Tap the Scan tab at the bottom.", "2. Enter a public IP or hostname (e.g. scanme.nmap.org).", "3. Choose Quick Scan (26 ports) or Deep Scan (37 ports).", "4. Tap Start Scan — results stream live in the terminal.", "5. Tap View Scan Results when complete."],
                },
                {
                  title: "What Targets Work?",
                  icon: Globe,
                  color: "#f59e0b",
                  body: ["✅ Public IPs — any internet-facing server", "✅ Hostnames — scanme.nmap.org, your-domain.com", "✅ Cloud VMs — AWS, GCP, Azure instances", "❌ Private IPs (192.168.x.x, 10.x.x.x) — not reachable from cloud. All ports appear closed, which IS the correct internet-perspective result."],
                },
                {
                  title: "Understanding Risk Levels",
                  icon: AlertTriangle,
                  color: "#ef4444",
                  body: ["🔴 Critical — Fix immediately. RDP, Telnet, Redis, MongoDB without auth.", "🟠 High — Fix soon. FTP, SMB, unencrypted LDAP, Jupyter Notebook.", "🟡 Medium — Maintenance window. HTTP without HTTPS, SMTP without TLS.", "🟢 Low — Informational. Well-configured HTTPS/SMTPS. Keep certs updated."],
                },
                {
                  title: "Your Operator ID",
                  icon: Key,
                  color: "#a78bfa",
                  body: [`Your Operator ID (${operatorId}) is derived from your unique account ID.`, "It appears in scan reports and support tickets.", "Copy it from the Support section of this profile page."],
                },
                {
                  title: "Scan History & Alerts",
                  icon: Bell,
                  color: "#f97316",
                  body: ["Every completed scan is saved automatically.", "The History tab shows all past scans with timestamps.", "For every critical or high-risk port found, a real alert is auto-generated in the Notifications tab."],
                },
              ].map((section) => (
                <div key={section.title} className="mb-4 rounded-2xl overflow-hidden"
                  style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
                  <div className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(28,50,84,0.5)" }}>
                    <div className="flex items-center justify-center rounded-xl"
                      style={{ width: 30, height: 30, background: `${section.color}15`, border: `1px solid ${section.color}30`, flexShrink: 0 }}>
                      <section.icon size={14} style={{ color: section.color }} />
                    </div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>{section.title}</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-1.5">
                    {section.body.map((line, i) => (
                      <p key={i} style={{ fontSize: "12px", color: "#6a8aaa", fontFamily: "Inter", lineHeight: 1.6 }}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Send Feedback Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col"
            style={{ background: "#060e1e", zIndex: 50 }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center gap-3">
              <button onClick={() => { setShowFeedback(false); setFeedbackSent(false); setFeedbackText(""); }}
                className="flex items-center justify-center rounded-xl"
                style={{ width: 36, height: 36, background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)", flexShrink: 0 }}>
                <X size={16} style={{ color: "#8899b8" }} />
              </button>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Send Feedback</h2>
                <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>Help us improve PortSentinel</p>
              </div>
            </div>

            <div className="flex-1 px-5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <AnimatePresence mode="wait">
                {feedbackSent ? (
                  /* Success state */
                  <motion.div key="sent"
                    initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center gap-4 pt-16 pb-8">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className="flex items-center justify-center rounded-full"
                      style={{ width: 72, height: 72, background: "rgba(167,139,250,0.1)", border: "2px solid rgba(167,139,250,0.4)", boxShadow: "0 0 30px rgba(167,139,250,0.2)" }}>
                      <CheckCircle size={34} style={{ color: "#a78bfa" }} strokeWidth={1.5} />
                    </motion.div>
                    <p style={{ fontSize: "18px", fontWeight: 700, color: "#a78bfa", fontFamily: "Inter" }}>Feedback Sent!</p>
                    <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter", textAlign: "center", lineHeight: 1.6 }}>
                      Thank you for helping us improve PortSentinel.{"\n"}We review every submission carefully.
                    </p>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => { setShowFeedback(false); setFeedbackSent(false); setFeedbackText(""); setFeedbackCategory("general"); }}
                      className="mt-4 px-8 py-3 rounded-2xl"
                      style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", fontSize: "14px", fontWeight: 600, fontFamily: "Inter" }}>
                      Done
                    </motion.button>
                  </motion.div>
                ) : (
                  /* Form */
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5 pb-8 pt-2">
                    {/* Category */}
                    <div>
                      <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.8px" }}>Category</p>
                      <div className="flex gap-2">
                        {([
                          { id: "bug" as const, label: "🐛 Bug", color: "#ef4444" },
                          { id: "feature" as const, label: "💡 Feature", color: "#38bdf8" },
                          { id: "general" as const, label: "💬 General", color: "#a78bfa" },
                        ]).map((cat) => (
                          <button key={cat.id} onClick={() => setFeedbackCategory(cat.id)}
                            className="flex-1 py-2.5 rounded-xl text-center"
                            style={{
                              background: feedbackCategory === cat.id ? `${cat.color}15` : "rgba(10,20,40,0.6)",
                              border: feedbackCategory === cat.id ? `1px solid ${cat.color}50` : "1px solid rgba(28,50,84,0.6)",
                              color: feedbackCategory === cat.id ? cat.color : "#4a6080",
                              fontSize: "11px", fontFamily: "Inter", fontWeight: 600, transition: "all 0.15s",
                            }}>
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.8px" }}>Your Message</p>
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
                        placeholder="Describe your feedback, bug, or feature request in detail…"
                        rows={6}
                        style={{
                          width: "100%", background: "rgba(10,20,40,0.8)",
                          border: feedbackText.length > 0 ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(28,50,84,0.8)",
                          borderRadius: 14, padding: "14px", color: "#c8d8f0",
                          fontSize: "13px", fontFamily: "Inter", lineHeight: 1.6,
                          outline: "none", resize: "none", transition: "border-color 0.2s",
                        }}
                      />
                      <p style={{ fontSize: "10px", color: feedbackText.length > 450 ? "#f59e0b" : "#2a3f5e", fontFamily: "Inter", textAlign: "right", marginTop: 4 }}>
                        {feedbackText.length}/500
                      </p>
                    </div>

                    {/* Auto-attached info */}
                    <div className="px-3 py-2.5 rounded-xl flex items-center gap-2"
                      style={{ background: "rgba(28,50,84,0.3)", border: "1px solid rgba(28,50,84,0.5)" }}>
                      <Terminal size={12} style={{ color: "#2a3f5e" }} />
                      <span style={{ fontSize: "10px", color: "#2a3f5e", fontFamily: "monospace" }}>
                        Submitting as: {operatorId} · {profile.email || user?.email || ""}
                      </span>
                    </div>

                    {/* Submit */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      disabled={feedbackText.trim().length < 10 || feedbackSending}
                      onClick={async () => {
                        if (feedbackText.trim().length < 10) return;
                        setFeedbackSending(true);
                        // Simulate a short delay for realism, then mark sent
                        await new Promise((r) => setTimeout(r, 900));
                        setFeedbackSending(false);
                        setFeedbackSent(true);
                      }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                      style={{
                        background: feedbackText.trim().length >= 10
                          ? "linear-gradient(135deg,rgba(167,139,250,0.25),rgba(139,92,246,0.2))"
                          : "rgba(10,20,40,0.4)",
                        border: feedbackText.trim().length >= 10
                          ? "1px solid rgba(167,139,250,0.4)"
                          : "1px solid rgba(28,50,84,0.5)",
                        color: feedbackText.trim().length >= 10 ? "#a78bfa" : "#2a3f5e",
                        fontSize: "14px", fontWeight: 600, fontFamily: "Inter", transition: "all 0.2s",
                      }}>
                      {feedbackSending
                        ? <><RefreshCw size={15} className="animate-spin" /> Sending…</>
                        : <><MessageCircle size={15} /> Submit Feedback</>}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}