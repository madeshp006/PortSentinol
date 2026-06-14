import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Clock, Radar, AlertTriangle, Search, Trash2, RefreshCw, Database } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { hydrateScan, rememberCurrentScan } from "../utils/scanData";

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: "Low Risk", color: "#22c55e" };
  if (score >= 60) return { label: "Med Risk", color: "#f59e0b" };
  if (score >= 40) return { label: "High Risk", color: "#f97316" };
  return { label: "Critical", color: "#ef4444" };
};

export function HistoryScreen() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getScans(token);
      setScans(data.map((scan: any) => hydrateScan(scan)));
    } catch (e: any) {
      setError(e.message || "Failed to load scan history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const openScan = (scan: any) => {
    const hydrated = hydrateScan(scan);
    rememberCurrentScan(hydrated);
    if (["queued", "running"].includes(hydrated.status)) {
      navigate("/app/scan/progress", { state: { scan: hydrated } });
      return;
    }
    navigate("/app/scan/results", { state: { scan: hydrated } });
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeleting(id);
    try {
      await api.deleteScan(token, id);
      setScans((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      console.log("Delete scan error:", e.message);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = scans.filter(
    (h) =>
      (h.target || "").includes(search) ||
      (h.scanType || "").toLowerCase().includes(search.toLowerCase()) ||
      (h.status || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPorts = scans.reduce((a, h) => a + (h.openPorts || 0), 0);
  const avgScore = scans.length ? Math.round(scans.reduce((a, h) => a + (h.riskScore || 0), 0) / scans.length) : 0;

  return (
    <div className="pb-4" style={{ minHeight: "780px" }}>
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Scan History</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{loading ? "Loading…" : `${scans.length} workflow job${scans.length !== 1 ? "s" : ""}`}</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
          <motion.div animate={loading ? { rotate: 360 } : { rotate: 0 }} transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
            <RefreshCw size={15} style={{ color: "#38bdf8" }} />
          </motion.div>
        </button>
      </div>

      <div className="flex gap-2.5 px-5 mb-4 overflow-x-auto scrollbar-hide pb-1">
        {[
          { label: "Total Jobs", value: scans.length, color: "#38bdf8" },
          { label: "Avg Score", value: `${avgScore}/100`, color: "#f59e0b" },
          { label: "Ports Found", value: totalPorts, color: "#f97316" },
          { label: "Running", value: scans.filter((s) => s.status === "running").length, color: "#a78bfa" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1 px-4 py-3 rounded-2xl whitespace-nowrap" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <span style={{ fontSize: "18px", fontWeight: 700, color: s.color, fontFamily: "Inter" }}>{s.value}</span>
            <span style={{ fontSize: "10px", color: "#3a5070", fontFamily: "Inter" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="px-5 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#4a6080" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search target, type, or status..." style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)", borderRadius: "14px", color: "#c8d8f0", fontSize: "13px", fontFamily: "Inter", padding: "11px 16px 11px 38px", width: "100%", outline: "none" }} />
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-2xl flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertTriangle size={14} style={{ color: "#ef4444" }} />
          <span style={{ fontSize: "12px", color: "#ef4444", fontFamily: "Inter" }}>{error}</span>
        </div>
      )}

      {loading && (
        <div className="px-5 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl px-4 py-4 animate-pulse" style={{ height: 100, background: "rgba(10,20,40,0.5)", border: "1px solid rgba(28,50,84,0.5)" }} />
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 px-5 mt-12">
          <div className="rounded-2xl flex items-center justify-center" style={{ width: 64, height: 64, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)" }}>
            <Database size={28} style={{ color: "#38bdf8" }} />
          </div>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>{search ? "No matching jobs" : "No scans yet"}</p>
          <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter", textAlign: "center" }}>{search ? "Try a different search term." : "Run your first workflow to see results here."}</p>
        </div>
      )}

      {!loading && (
        <div className="px-5 flex flex-col gap-3">
          {filtered.map((scan, i) => {
            const risk = getRiskLevel(scan.riskScore || 0);
            const statusColor = scan.status === "completed" ? "#22c55e" : scan.status === "failed" ? "#ef4444" : scan.status === "cancelled" ? "#f59e0b" : "#38bdf8";
            return (
              <motion.div key={scan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex flex-col px-4 py-4 rounded-2xl cursor-pointer" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }} onClick={() => openScan(scan)}>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center rounded-xl mt-0.5" style={{ width: "40px", height: "40px", background: `${risk.color}12`, border: `1px solid ${risk.color}25`, flexShrink: 0 }}>
                    <Radar size={18} style={{ color: risk.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "JetBrains Mono, monospace" }}>{scan.target}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded" style={{ background: "rgba(28,50,84,0.6)", color: "#4a6080", fontSize: "10px", fontFamily: "Inter" }}>{scan.scanType}</span>
                      <span className="px-2 py-0.5 rounded" style={{ background: `${statusColor}15`, color: statusColor, fontSize: "10px", fontFamily: "Inter", textTransform: "capitalize" }}>{scan.status}</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(scan.id); }} disabled={deleting === scan.id} className="mt-1">
                    {deleting === scan.id ? <RefreshCw size={13} style={{ color: "#4a6080", animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={13} style={{ color: "#3a5070" }} />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>Score {scan.riskScore} · Ports {scan.openPorts}</span>
                  <span style={{ fontSize: "11px", color: statusColor, fontFamily: "Inter" }}>{scan.progress ?? 0}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
