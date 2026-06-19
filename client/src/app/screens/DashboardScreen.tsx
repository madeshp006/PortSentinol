import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  RadialBarChart, RadialBar, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
  Bell, Radar, Shield, Server, AlertTriangle, FileText, Clock,
  TrendingUp, ChevronRight, Zap, Activity, ScanLine,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAlerts } from "../context/AlertsContext";
import * as api from "../utils/api";

const quickActions = [
  { label: "Quick Scan", icon: Radar, color: "#38bdf8", path: "/app/scan" },
  { label: "Schedule", icon: Clock, color: "#22c55e", path: "/app/schedule" },
  { label: "Reports", icon: FileText, color: "#a78bfa", path: "/app/reports" },
  { label: "History", icon: TrendingUp, color: "#f59e0b", path: "/app/history" },
  { label: "Ops", icon: Shield, color: "#06b6d4", path: "/app/admin" },
];

function fmtAgo(iso: string) {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return iso;
  }
}

function getScoreLabel(score: number) {
  if (score >= 80) return { label: "Low Risk", color: "#22c55e" };
  if (score >= 60) return { label: "Moderate Risk", color: "#f59e0b" };
  if (score >= 40) return { label: "High Risk", color: "#f97316" };
  return { label: "Critical Risk", color: "#ef4444" };
}

export function DashboardScreen() {
  const navigate = useNavigate();
  const { token, profile, setProfile } = useAuth();
  const { alerts, unreadCount, reload: reloadAlerts } = useAlerts();

  const [scans, setScans] = useState<any[]>([]);
  const [scansLoading, setScansLoading] = useState(true);

  // Load profile name if not already in context
  useEffect(() => {
    if (!token) return;
    if (profile) return;
    api.getProfile(token)
      .then((p) => setProfile(p))
      .catch((e) => console.log("Dashboard: load profile error:", e.message));
  }, [token, profile]);

  // Load scans for stats
  useEffect(() => {
    if (!token) return;
    api.getScans(token)
      .then((data) => setScans(data))
      .catch((e) => console.log("Dashboard: load scans error:", e.message))
      .finally(() => setScansLoading(false));
  }, [token]);

  // Reload alerts when landing on dashboard
  useEffect(() => {
    if (token) reloadAlerts();
  }, [token]);

  // ── Derived stats from real data ──
  const latestScan = scans[0] ?? null;
  const hasScans = scans.length > 0;

  const riskScore = latestScan?.riskScore ?? null;
  const scoreLabel = riskScore !== null ? getScoreLabel(riskScore) : null;

  const latestPorts: any[] = latestScan?.ports ?? [];
  const riskyPorts = latestPorts.filter(
    (p) => p.risk === "critical" || p.risk === "high"
  ).length;
  const services = latestScan?.servicesDetected ?? 0;

  const riskPie = [
    { name: "Critical", value: latestPorts.filter((p) => p.risk === "critical").length, color: "#ef4444" },
    { name: "High", value: latestPorts.filter((p) => p.risk === "high").length, color: "#f97316" },
    { name: "Medium", value: latestPorts.filter((p) => p.risk === "medium").length, color: "#f59e0b" },
    { name: "Low", value: latestPorts.filter((p) => p.risk === "low").length, color: "#22c55e" },
  ].filter((r) => r.value > 0);

  const riskPieTotal = riskPie.reduce((s, r) => s + r.value, 0);

  const stats = [
    {
      label: "Scans Run",
      value: hasScans ? String(scans.length) : "0",
      icon: ScanLine,
      color: "#38bdf8",
      bg: "rgba(56,189,248,0.1)",
      border: "rgba(56,189,248,0.2)",
    },
    {
      label: "Risky Ports",
      value: hasScans ? String(riskyPorts) : "0",
      icon: AlertTriangle,
      color: "#f97316",
      bg: "rgba(249,115,22,0.1)",
      border: "rgba(249,115,22,0.2)",
    },
    {
      label: "Services",
      value: hasScans ? String(services) : "0",
      icon: Activity,
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.1)",
      border: "rgba(167,139,250,0.2)",
    },
    {
      label: "Alerts",
      value: String(unreadCount),
      icon: Bell,
      color: unreadCount > 0 ? "#ef4444" : "#4a6080",
      bg: unreadCount > 0 ? "rgba(239,68,68,0.1)" : "rgba(28,50,84,0.2)",
      border: unreadCount > 0 ? "rgba(239,68,68,0.2)" : "rgba(28,50,84,0.3)",
    },
  ];

  const displayName = profile?.name || "Operator";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";

  const lastScanAgo =
    latestScan?.savedAt
      ? fmtAgo(latestScan.savedAt)
      : latestScan?.timestamp
      ? fmtAgo(latestScan.timestamp)
      : null;

  const recentAlerts = alerts.slice(0, 3);

  return (
    <div className="pb-4" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>{greeting}</p>
          <h1
            style={{
              fontSize: "19px", fontWeight: 700, color: "#e8f0fe",
              fontFamily: "Inter", letterSpacing: "-0.3px",
            }}
          >
            {displayName}
          </h1>
        </div>
        <button
          onClick={() => navigate("/app/notifications")}
          className="relative flex items-center justify-center rounded-2xl"
          style={{
            width: "42px", height: "42px",
            background: "rgba(10, 20, 40, 0.8)",
            border: "1px solid rgba(28, 50, 84, 0.8)",
          }}
        >
          <Bell size={18} style={{ color: "#8899b8" }} />
          {unreadCount > 0 && (
            <span
              className="absolute flex items-center justify-center rounded-full"
              style={{
                top: "-3px", right: "-3px",
                width: "16px", height: "16px",
                background: "#ef4444",
                fontSize: "9px", color: "white", fontWeight: 700,
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Security Score Card */}
      <div className="mx-5 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5"
          style={{
            background: "linear-gradient(135deg, #0d1f3c 0%, #091528 100%)",
            border: "1px solid rgba(28, 50, 84, 0.8)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          {hasScans ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>Security Score</p>
                  <div className="flex items-end gap-1">
                    <span
                      style={{
                        fontSize: "38px", fontWeight: 800,
                        color: scoreLabel?.color ?? "#22c55e",
                        fontFamily: "Inter", lineHeight: 1.1,
                      }}
                    >
                      {riskScore}
                    </span>
                    <span style={{ fontSize: "18px", color: "#3a5070", fontFamily: "Inter", marginBottom: "4px" }}>/100</span>
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mt-1"
                    style={{
                      background: `${scoreLabel?.color ?? "#22c55e"}18`,
                      border: `1px solid ${scoreLabel?.color ?? "#22c55e"}30`,
                    }}
                  >
                    <div
                      className="rounded-full animate-pulse"
                      style={{ width: "5px", height: "5px", background: scoreLabel?.color ?? "#22c55e" }}
                    />
                    <span
                      style={{
                        fontSize: "11px", color: scoreLabel?.color ?? "#22c55e",
                        fontFamily: "Inter", fontWeight: 500,
                      }}
                    >
                      {scoreLabel?.label}
                    </span>
                  </div>
                </div>

                <div style={{ width: "110px", height: "110px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%" cy="50%"
                      innerRadius="68%" outerRadius="100%"
                      startAngle={210} endAngle={-30}
                      data={[
                        { value: riskScore, fill: scoreLabel?.color ?? "#22c55e" },
                        { value: 100 - (riskScore ?? 0), fill: "rgba(28,50,84,0.4)" },
                      ]}
                    >
                      <RadialBar dataKey="value" cornerRadius={8} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Risk bars */}
              {riskPie.length > 0 && (
                <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(${riskPie.length}, 1fr)` }}>
                  {riskPie.map((r) => (
                    <div key={r.name}>
                      <div className="rounded-full mb-1" style={{ height: "3px", background: "rgba(28,50,84,0.6)" }}>
                        <div
                          className="rounded-full h-full"
                          style={{
                            width: riskPieTotal > 0 ? `${(r.value / riskPieTotal) * 100}%` : "0%",
                            background: r.color,
                          }}
                        />
                      </div>
                      <p style={{ fontSize: "9px", color: r.color, fontFamily: "Inter" }}>
                        {r.value} {r.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* No scans yet state */
            <div className="flex flex-col items-center justify-center py-4 gap-3">
              <div
                className="flex items-center justify-center rounded-2xl"
                style={{
                  width: "56px", height: "56px",
                  background: "rgba(56,189,248,0.08)",
                  border: "1px solid rgba(56,189,248,0.2)",
                }}
              >
                <Shield size={26} style={{ color: "#38bdf8" }} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#c8d8f0", fontFamily: "Inter" }}>
                  No scan data yet
                </p>
                <p style={{ fontSize: "11px", color: "#3a5070", fontFamily: "Inter", marginTop: "4px" }}>
                  Run your first scan to generate a security score
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/app/scan")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(59,130,246,0.15))",
                  border: "1px solid rgba(56,189,248,0.35)",
                  color: "#38bdf8",
                  fontSize: "13px",
                  fontFamily: "Inter",
                  fontWeight: 600,
                }}
              >
                <Radar size={15} />
                Start First Scan
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 px-5 mb-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{
              background: "rgba(10, 20, 40, 0.7)",
              border: `1px solid ${s.border}`,
            }}
          >
            <div
              className="flex items-center justify-center rounded-xl mb-3"
              style={{ width: "36px", height: "36px", background: s.bg }}
            >
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <p style={{ fontSize: "24px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
              {s.value}
            </p>
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-4">
        <p
          style={{
            fontSize: "12px", color: "#4a6080", fontFamily: "Inter",
            marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.8px",
          }}
        >
          Quick Actions
        </p>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a, i) => (
            <motion.button
              key={a.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 py-3 rounded-2xl"
              style={{
                background: "rgba(10, 20, 40, 0.7)",
                border: "1px solid rgba(28, 50, 84, 0.7)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: "38px", height: "38px",
                  background: `${a.color}15`,
                  border: `1px solid ${a.color}25`,
                }}
              >
                <a.icon size={18} style={{ color: a.color }} />
              </div>
              <span style={{ fontSize: "10px", color: "#6a8aaa", fontFamily: "Inter" }}>{a.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Risk Distribution — only shown when scans exist */}
      {hasScans && riskPie.length > 0 && (
        <div
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: "rgba(10, 20, 40, 0.7)", border: "1px solid rgba(28, 50, 84, 0.7)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>
              Risk Distribution
            </p>
            <button
              onClick={() => navigate("/app/scan/results")}
              style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "Inter" }}
            >
              View All
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ width: "90px", height: "90px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskPie}
                    cx="50%" cy="50%"
                    innerRadius="55%" outerRadius="85%"
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {riskPie.map((r, i) => <Cell key={i} fill={r.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {riskPie.map((r) => (
                <div key={r.name} className="flex items-center gap-2">
                  <div
                    className="rounded-full"
                    style={{ width: "7px", height: "7px", background: r.color, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: "11px", color: "#6a8aaa", fontFamily: "Inter", flex: 1 }}>
                    {r.name}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: r.color, fontFamily: "Inter" }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>
            Recent Alerts
          </p>
          <button
            onClick={() => navigate("/app/notifications")}
            className="flex items-center gap-1"
            style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "Inter" }}
          >
            View All <ChevronRight size={12} />
          </button>
        </div>

        {recentAlerts.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-8 rounded-2xl"
            style={{ background: "rgba(10,20,40,0.5)", border: "1px solid rgba(28,50,84,0.5)" }}
          >
            <Bell size={22} style={{ color: "#2a3f5e" }} />
            <p style={{ fontSize: "12px", color: "#3a5070", fontFamily: "Inter" }}>No alerts yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentAlerts.map((alert, i) => {
              const color =
                alert.risk === "critical" ? "#ef4444" :
                alert.risk === "high" ? "#f97316" :
                alert.risk === "medium" ? "#f59e0b" :
                alert.risk === "low" ? "#22c55e" : "#3b82f6";
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: "rgba(10, 20, 40, 0.7)",
                    border: "1px solid rgba(28, 50, 84, 0.7)",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg mt-0.5"
                    style={{
                      width: "30px", height: "30px",
                      background: `${color}15`,
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>
                      {alert.title}
                    </p>
                    <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginTop: "2px" }}>
                      {typeof alert.timestamp === "string" && alert.timestamp.includes("T")
                        ? fmtAgo(alert.timestamp)
                        : alert.timestamp}
                      {alert.target && alert.target !== "—" ? ` · ${alert.target}` : ""}
                    </p>
                  </div>
                  {!alert.read && (
                    <div
                      className="rounded-full mt-1"
                      style={{ width: "6px", height: "6px", background: "#ef4444", flexShrink: 0 }}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Last Scan CTA */}
      <div className="mx-5">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/app/scan")}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(14,107,176,0.25), rgba(10,79,138,0.15))",
            border: "1px solid rgba(56,189,248,0.25)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: "38px", height: "38px", background: "rgba(56,189,248,0.12)" }}
            >
              <Zap size={18} style={{ color: "#38bdf8" }} />
            </div>
            <div className="text-left">
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#e8f0fe", fontFamily: "Inter" }}>
                {hasScans ? "Start New Scan" : "Start First Scan"}
              </p>
              <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
                {lastScanAgo ? `Last scan ${lastScanAgo}` : "No scans run yet"}
              </p>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "#38bdf8" }} />
        </motion.button>
      </div>
    </div>
  );
}
