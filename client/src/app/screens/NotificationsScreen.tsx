import * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  Bell, BellOff, CheckCheck, RefreshCw,
  AlertTriangle, Info, XCircle, Trash2,
} from "lucide-react";
import { type RiskLevel } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { useAlerts } from "../context/AlertsContext";
import * as api from "../utils/api";

const filterTabs = ["All", "Unread", "Critical", "High", "Medium", "Low"];

const riskIcon: Record<string, React.ElementType> = {
  critical: XCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: Info,
  info: Info,
};

const riskColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
  info: "#3b82f6",
};

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

export function NotificationsScreen() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { alerts, loading, reload, updateAlerts } = useAlerts();
  const [filter, setFilter] = useState("All");

  useEffect(() => { reload(); }, [token]);

  const filtered = alerts.filter((a) => {
    if (filter === "All") return true;
    if (filter === "Unread") return !a.read;
    return a.risk === filter.toLowerCase();
  });

  const markRead = async (id: string) => {
    if (!token) return;
    updateAlerts(alerts.map((a) => (a.id === id ? { ...a, read: true } : a)));
    try { await api.markAlertRead(token, id); } catch (e: any) { console.log("Mark read error:", e.message); }
  };

  const markAllRead = async () => {
    if (!token) return;
    updateAlerts(alerts.map((a) => ({ ...a, read: true })));
    try { await api.markAllAlertsRead(token); } catch (e: any) { console.log("Mark all read error:", e.message); }
  };

  const clearAll = async () => {
    if (!token) return;
    updateAlerts([]);
    try { await api.clearAlerts(token); } catch (e: any) { console.log("Clear alerts error:", e.message); }
  };

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="pb-4" style={{ minHeight: "780px" }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Alerts</h2>
            {unreadCount > 0 && (
              <span
                className="flex items-center justify-center rounded-full"
                style={{ width: "20px", height: "20px", background: "#ef4444", fontSize: "10px", color: "white", fontWeight: 700 }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
            {loading ? "Loading…" : `${alerts.length} notification${alerts.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center justify-center rounded-xl"
            style={{ width: 32, height: 32, background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
          >
            <motion.div animate={loading ? { rotate: 360 } : { rotate: 0 }}
              transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
              <RefreshCw size={13} style={{ color: "#38bdf8" }} />
            </motion.div>
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
              style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "12px", fontFamily: "Inter" }}
            >
              <CheckCheck size={14} /> Read all
            </button>
          )}
          {alerts.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center justify-center rounded-xl"
              style={{ width: 32, height: 32, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <Trash2 size={13} style={{ color: "#ef4444" }} />
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-5 mb-4 overflow-x-auto scrollbar-hide pb-1">
        {filterTabs.map((tab) => {
          const isActive = filter === tab;
          let color = "#38bdf8";
          if (tab === "Critical") color = "#ef4444";
          else if (tab === "High") color = "#f97316";
          else if (tab === "Medium") color = "#f59e0b";
          else if (tab === "Low") color = "#22c55e";

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className="px-3.5 py-1.5 rounded-xl whitespace-nowrap"
              style={{
                background: isActive ? `${color}15` : "rgba(10,20,40,0.6)",
                border: isActive ? `1px solid ${color}35` : "1px solid rgba(28,50,84,0.5)",
                color: isActive ? color : "#4a6080",
                fontSize: "12px",
                fontWeight: isActive ? 600 : 400,
                fontFamily: "Inter",
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="px-5 flex flex-col gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl px-4 py-4 animate-pulse"
              style={{ height: 88, background: "rgba(10,20,40,0.5)", border: "1px solid rgba(28,50,84,0.5)" }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <BellOff size={32} style={{ color: "#2a3f5e" }} />
          <p style={{ fontSize: "14px", color: "#4a6080", fontFamily: "Inter" }}>
            {filter === "All" ? "No alerts yet" : `No ${filter.toLowerCase()} alerts`}
          </p>
          {filter === "All" && (
            <p style={{ fontSize: "12px", color: "#2a3f5e", fontFamily: "Inter" }}>
              Run a scan to generate alerts.
            </p>
          )}
        </div>
      )}

      {/* Alerts list */}
      {!loading && (
        <div className="px-5 flex flex-col gap-2.5">
          {filtered.map((alert, i) => {
            const color = riskColor[alert.risk] || "#3b82f6";
            const Icon = riskIcon[alert.risk] || Info;

            return (
              <motion.button
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  markRead(alert.id);
                  if (alert.risk !== "info") navigate("/app/scan/results/risk");
                }}
                className="flex items-start gap-3 px-4 py-3.5 rounded-2xl text-left w-full"
                style={{
                  background: !alert.read ? `${color}07` : "rgba(10,20,40,0.6)",
                  border: !alert.read ? `1px solid ${color}25` : "1px solid rgba(28,50,84,0.5)",
                  position: "relative",
                }}
              >
                {/* Unread dot */}
                {!alert.read && (
                  <div
                    className="absolute top-3 right-3 rounded-full"
                    style={{ width: "7px", height: "7px", background: color }}
                  />
                )}

                {/* Icon */}
                <div
                  className="flex items-center justify-center rounded-xl mt-0.5"
                  style={{ width: "38px", height: "38px", background: `${color}12`, flexShrink: 0 }}
                >
                  <Icon size={17} style={{ color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <p style={{
                    fontSize: "13px",
                    fontWeight: !alert.read ? 600 : 500,
                    color: !alert.read ? "#c8d8f0" : "#6a8aaa",
                    fontFamily: "Inter",
                  }}>
                    {alert.title}
                  </p>
                  <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginTop: "3px", lineHeight: 1.5 }}>
                    {alert.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded capitalize border"
                      style={{ background: `${color}10`, color, borderColor: `${color}25`, fontSize: "10px", fontWeight: 600, fontFamily: "Inter" }}>
                      {alert.risk}
                    </span>
                    {alert.port && (
                      <span className="font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: "10px" }}>
                        :{alert.port}
                      </span>
                    )}
                    <span style={{ fontSize: "10px", color: "#2a3f5e", fontFamily: "Inter" }}>
                      {typeof alert.timestamp === "string" && alert.timestamp.includes("T")
                        ? fmtTime(alert.timestamp)
                        : alert.timestamp}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}