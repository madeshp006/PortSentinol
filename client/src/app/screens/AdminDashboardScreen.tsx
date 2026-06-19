import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, RefreshCw, Users, Shield, Bell, Clock3 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

export function AdminDashboardScreen() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const overview = await api.getAdminOverview(token);
      setData(overview);
    } catch (e: any) {
      setError(e.message || "Failed to load operations overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      <div className="px-5 pt-4 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/app")} className="flex items-center justify-center rounded-xl" style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div className="flex-1">
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Operations Dashboard</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>Workflow health, jobs, and audit activity</p>
        </div>
        <button onClick={load} className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
          <motion.div animate={loading ? { rotate: 360 } : { rotate: 0 }} transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
            <RefreshCw size={15} style={{ color: "#38bdf8" }} />
          </motion.div>
        </button>
      </div>

      {error && <div className="mx-5 mb-4 px-4 py-3 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontSize: "12px", fontFamily: "Inter" }}>{error}</div>}

      <div className="grid grid-cols-2 gap-3 px-5 mb-4">
        {[
          { label: "Users", value: data?.summary?.users ?? 0, icon: Users, color: "#38bdf8" },
          { label: "Unread Alerts", value: data?.summary?.unreadAlerts ?? 0, icon: Bell, color: "#ef4444" },
          { label: "Completed", value: data?.summary?.completed ?? 0, icon: Shield, color: "#22c55e" },
          { label: "Running", value: data?.summary?.running ?? 0, icon: Clock3, color: "#a78bfa" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
            <div className="flex items-center justify-between mb-2">
              <card.icon size={16} style={{ color: card.color }} />
              <span style={{ fontSize: "22px", fontWeight: 800, color: card.color, fontFamily: "Inter" }}>{card.value}</span>
            </div>
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter", marginBottom: "10px" }}>Recent Workflow Jobs</p>
        <div className="flex flex-col gap-2">
          {(data?.recentScans || []).map((scan: any) => (
            <div key={scan.id} className="rounded-xl px-3 py-3" style={{ background: "rgba(7,13,30,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p style={{ fontSize: "12px", color: "#c8d8f0", fontFamily: "JetBrains Mono, monospace" }}>{scan.target}</p>
                  <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginTop: "3px" }}>{scan.scanType}</p>
                </div>
                <span style={{ fontSize: "10px", color: scan.status === "completed" ? "#22c55e" : scan.status === "failed" ? "#ef4444" : "#38bdf8", fontFamily: "Inter", textTransform: "capitalize" }}>{scan.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 rounded-2xl p-4" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter", marginBottom: "10px" }}>Recent Audit Activity</p>
        <div className="flex flex-col gap-2">
          {(data?.recentAuditLogs || []).map((log: any) => (
            <div key={log.id} className="rounded-xl px-3 py-3" style={{ background: "rgba(7,13,30,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <p style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "Inter" }}>{log.action}</p>
              <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginTop: "3px" }}>{new Date(log.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
