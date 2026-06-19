import * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ChevronLeft, Plus, Calendar, Clock, Radar, Trash2,
  Power, RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

const frequencies = ["Daily", "Weekly", "Monthly", "Every 6 hours", "Every 12 hours"];
const scanTypes = ["Quick Scan", "Deep Scan", "Custom Scan"];

const inputStyle: React.CSSProperties = {
  background: "rgba(10,20,40,0.8)",
  border: "1px solid rgba(28,50,84,0.8)",
  borderRadius: "12px",
  color: "#c8d8f0",
  fontSize: "13px",
  fontFamily: "Inter",
  padding: "11px 14px",
  outline: "none",
  width: "100%",
};

export function ScheduledScansScreen() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTarget, setNewTarget] = useState("");
  const [newFreq, setNewFreq] = useState("Daily");
  const [newName, setNewName] = useState("");
  const [newScanType, setNewScanType] = useState("Quick Scan");
  const [addError, setAddError] = useState("");

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getSchedules(token);
      setScans(data);
    } catch (e: any) {
      console.log("Load schedules error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const toggleActive = async (id: string) => {
    if (!token) return;
    const scan = scans.find((s) => s.id === id);
    if (!scan) return;
    const newActive = !scan.active;
    setScans((prev) => prev.map((s) => (s.id === id ? { ...s, active: newActive } : s)));
    try {
      await api.updateSchedule(token, id, { active: newActive });
    } catch (e: any) {
      console.log("Toggle schedule error:", e.message);
      // Revert on error
      setScans((prev) => prev.map((s) => (s.id === id ? { ...s, active: !newActive } : s)));
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!token) return;
    setScans((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.deleteSchedule(token, id);
    } catch (e: any) {
      console.log("Delete schedule error:", e.message);
      load(); // Reload on error
    }
  };

  const createSchedule = async () => {
    setAddError("");
    if (!newTarget.trim()) { setAddError("Target IP or subnet is required."); return; }
    if (!token) return;
    setSaving(true);
    try {
      const newScan = await api.createSchedule(token, {
        name: newName.trim() || "Custom Schedule",
        target: newTarget.trim(),
        frequency: newFreq,
        scanType: newScanType,
      });
      setScans((prev) => [...prev, newScan]);
      setShowAdd(false);
      setNewTarget("");
      setNewName("");
      setNewFreq("Daily");
      setNewScanType("Quick Scan");
    } catch (e: any) {
      setAddError(e.message || "Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center justify-center rounded-xl"
          style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div className="flex-1">
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Scheduled Scans</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
            {loading ? "Loading…" : `${scans.filter((s) => s.active).length} active schedule${scans.filter((s) => s.active).length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center justify-center rounded-xl mr-1"
          style={{ width: 32, height: 32, background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <motion.div animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
            <RefreshCw size={13} style={{ color: "#38bdf8" }} />
          </motion.div>
        </button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{
            background: showAdd ? "rgba(56,189,248,0.15)" : "rgba(56,189,248,0.1)",
            border: "1px solid rgba(56,189,248,0.25)",
            color: "#38bdf8",
            fontSize: "12px",
            fontFamily: "Inter",
          }}
        >
          <Plus size={14} /> Add
        </motion.button>
      </div>

      {/* Add form */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.2)" }}
        >
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#38bdf8", fontFamily: "Inter", marginBottom: "12px" }}>
            New Schedule
          </p>
          <div className="flex flex-col gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Schedule name (optional)"
              style={inputStyle}
            />
            <input
              value={newTarget}
              onChange={(e) => { setNewTarget(e.target.value); setAddError(""); }}
              placeholder="Target IP or subnet (e.g. 192.168.1.0/24)"
              style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace" }}
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={newFreq} onChange={(e) => setNewFreq(e.target.value)}
                style={{ ...inputStyle, fontSize: "12px", padding: "11px 12px" }}>
                {frequencies.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={newScanType} onChange={(e) => setNewScanType(e.target.value)}
                style={{ ...inputStyle, fontSize: "12px", padding: "11px 12px" }}>
                {scanTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {addError && (
              <p style={{ fontSize: "11px", color: "#ef4444", fontFamily: "Inter" }}>{addError}</p>
            )}
            <button
              onClick={createSchedule}
              disabled={saving}
              className="py-3 rounded-xl flex items-center justify-center gap-2"
              style={{
                background: saving ? "rgba(14,107,176,0.4)" : "linear-gradient(135deg, #0e6bb0, #0a4f8a)",
                border: "1px solid rgba(56,189,248,0.3)",
                color: "#e8f4ff",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "Inter",
              }}
            >
              {saving ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTop: "2px solid #fff" }} />
              ) : null}
              {saving ? "Creating…" : "Create Schedule"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="px-5 flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl px-4 py-4 animate-pulse"
              style={{ height: 120, background: "rgba(10,20,40,0.5)", border: "1px solid rgba(28,50,84,0.5)" }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && scans.length === 0 && !showAdd && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Calendar size={36} style={{ color: "#2a3f5e" }} />
          <p style={{ fontSize: "14px", color: "#4a6080", fontFamily: "Inter" }}>No scheduled scans</p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 rounded-xl"
            style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "13px", fontFamily: "Inter" }}
          >
            Add your first schedule
          </button>
        </div>
      )}

      {/* Schedules list */}
      {!loading && (
        <div className="px-5 flex flex-col gap-3">
          {scans.map((scan, i) => (
            <motion.div
              key={scan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl px-4 py-4"
              style={{
                background: scan.active ? "rgba(10,20,40,0.8)" : "rgba(7,13,30,0.5)",
                border: scan.active ? "1px solid rgba(28,50,84,0.8)" : "1px solid rgba(20,35,60,0.5)",
                opacity: scan.active ? 1 : 0.6,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center rounded-xl mt-0.5"
                  style={{
                    width: "40px", height: "40px",
                    background: scan.active ? "rgba(56,189,248,0.1)" : "rgba(28,50,84,0.3)",
                    flexShrink: 0,
                  }}
                >
                  <Radar size={18} style={{ color: scan.active ? "#38bdf8" : "#3a5070" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "13px", fontWeight: 600, color: scan.active ? "#c8d8f0" : "#4a6080", fontFamily: "Inter" }}>
                    {scan.name}
                  </p>
                  <p style={{ fontSize: "11px", color: "#3a5070", fontFamily: "JetBrains Mono, monospace", marginTop: "1px" }}>
                    {scan.target}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock size={11} style={{ color: "#4a6080" }} />
                      <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{scan.frequency}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Radar size={11} style={{ color: "#4a6080" }} />
                      <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{scan.scanType}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => toggleActive(scan.id)}
                    className="flex items-center justify-center rounded-xl"
                    style={{
                      width: "32px", height: "32px",
                      background: scan.active ? "rgba(34,197,94,0.1)" : "rgba(28,50,84,0.4)",
                      border: scan.active ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(28,50,84,0.5)",
                      color: scan.active ? "#22c55e" : "#3a5070",
                    }}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => deleteSchedule(scan.id)}
                    className="flex items-center justify-center rounded-xl"
                    style={{
                      width: "32px", height: "32px",
                      background: "rgba(239,68,68,0.07)",
                      border: "1px solid rgba(239,68,68,0.12)",
                      color: "#ef4444",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Next run info */}
              <div className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(28,50,84,0.5)" }}>
                <div>
                  <p style={{ fontSize: "10px", color: "#2a3f5e", fontFamily: "Inter" }}>Next run</p>
                  <p style={{ fontSize: "12px", color: scan.active ? "#38bdf8" : "#3a5070", fontFamily: "Inter", fontWeight: 500 }}>
                    {scan.active ? (scan.nextRun || "Calculating…") : "Paused"}
                  </p>
                </div>
                <div className="text-right">
                  <p style={{ fontSize: "10px", color: "#2a3f5e", fontFamily: "Inter" }}>Last run</p>
                  <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>{scan.lastRun || "Never"}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
