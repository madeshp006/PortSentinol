import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Server,
  Shield, FileText, Activity, Clock, RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { getRememberedScanId, hydrateScan, rememberCurrentScan } from "../utils/scanData";

function getScoreLabel(score: number) {
  if (score >= 80) return { label: "Low Risk", color: "#22c55e" };
  if (score >= 60) return { label: "Moderate Risk", color: "#f59e0b" };
  if (score >= 40) return { label: "High Risk", color: "#f97316" };
  return { label: "Critical Risk", color: "#ef4444" };
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function ScanResultsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  const passedScan = hydrateScan((location.state as any)?.scan);

  const [scan, setScan] = useState<any>(passedScan || null);
  const [loading, setLoading] = useState(!passedScan);

  useEffect(() => {
    if (passedScan) {
      setScan(passedScan);
      rememberCurrentScan(passedScan);
      setLoading(false);
      return;
    }
    if (!token) return;

    const rememberedId = getRememberedScanId();
    setLoading(true);

    const loader = rememberedId
      ? api.getScan(token, rememberedId).catch(() => null)
      : Promise.resolve(null);

    loader
      .then((selected: any) => {
        if (selected) {
          const hydrated = hydrateScan(selected);
          setScan(hydrated);
          rememberCurrentScan(hydrated);
          return;
        }

        return api.getScans(token).then((scans: any[]) => {
          if (scans.length > 0) {
            const hydrated = hydrateScan(scans[0]);
            setScan(hydrated);
            rememberCurrentScan(hydrated);
          }
        });
      })
      .catch((e) => console.log("Load recent scan error:", e.message))
      .finally(() => setLoading(false));
  }, [token, passedScan]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "780px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={26} style={{ color: "#38bdf8" }} />
        </motion.div>
        <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>Loading scan results...</p>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-8" style={{ minHeight: "780px" }}>
        <Shield size={40} style={{ color: "#2a3f5e" }} strokeWidth={1.5} />
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#4a6080", fontFamily: "Inter", textAlign: "center" }}>
          No scan results yet
        </p>
        <p style={{ fontSize: "12px", color: "#2a3f5e", fontFamily: "Inter", textAlign: "center" }}>
          Run a scan first to see results here.
        </p>
        <button
          onClick={() => navigate("/app/scan")}
          className="px-6 py-3 rounded-2xl"
          style={{ background: "linear-gradient(135deg,#0e6bb0,#0a4f8a)", color: "#e8f4ff", fontSize: "14px", fontWeight: 600, fontFamily: "Inter" }}
        >
          Start a Scan
        </button>
      </div>
    );
  }

  const ports: any[] = scan.ports ?? [];
  const scoreInfo = getScoreLabel(scan.riskScore);

  const riskPie = [
    { name: "Critical", value: ports.filter((p) => p.risk === "critical").length, color: "#ef4444" },
    { name: "High", value: ports.filter((p) => p.risk === "high").length, color: "#f97316" },
    { name: "Medium", value: ports.filter((p) => p.risk === "medium").length, color: "#f59e0b" },
    { name: "Low", value: ports.filter((p) => p.risk === "low").length, color: "#22c55e" },
  ].filter((r) => r.value > 0);

  const scanDate = fmtDate(scan.timestamp || scan.savedAt || new Date().toISOString());

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/app/scan")}
          className="flex items-center justify-center rounded-xl"
          style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div className="flex-1">
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Scan Results</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{scan.target}</p>
        </div>
        <button
          onClick={() => navigate("/app/reports", { state: { scan } })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "12px", fontFamily: "Inter" }}
        >
          <FileText size={13} /> Export
        </button>
      </div>

      {/* Summary card */}
      <div className="mx-5 mb-4 rounded-2xl p-5"
        style={{ background: "linear-gradient(135deg, #0d1f3c, #091528)", border: "1px solid rgba(28,50,84,0.8)" }}>
        <div className="flex items-center gap-4">
          <div
            className="relative flex items-center justify-center rounded-2xl"
            style={{
              width: "72px", height: "72px",
              background: `${scoreInfo.color}15`,
              border: `2px solid ${scoreInfo.color}40`,
            }}
          >
            <span style={{ fontSize: "26px", fontWeight: 800, color: scoreInfo.color, fontFamily: "Inter" }}>
              {scan.riskScore}
            </span>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>Security Score</p>
            <p style={{ fontSize: "22px", fontWeight: 700, color: scoreInfo.color, fontFamily: "Inter" }}>
              {scoreInfo.label}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <Clock size={11} style={{ color: "#4a6080" }} />
                <span style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>{scan.duration}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 size={11} style={{ color: "#22c55e" }} />
                <span style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>Scan complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* Meta badges */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {[
            { label: scan.target, badge: "Target" },
            { label: scan.scanType, badge: "Type" },
            { label: scanDate, badge: "Date" },
          ].map((m) => (
            <div key={m.badge} className="px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(7,13,30,0.6)", border: "1px solid rgba(28,50,84,0.5)" }}>
              <span style={{ fontSize: "9px", color: "#2a3f5e", fontFamily: "Inter", display: "block" }}>{m.badge}</span>
              <span style={{ fontSize: "11px", color: "#8899b8", fontFamily: "JetBrains Mono, monospace" }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2.5 px-5 mb-4">
        {[
          { label: "Open Ports", value: scan.openPorts ?? ports.length, color: "#f59e0b" },
          { label: "Services", value: scan.servicesDetected ?? ports.length, color: "#38bdf8" },
          { label: "Misconfigs", value: scan.misconfigurations ?? (scan.misconfigs?.length ?? 0), color: "#ef4444" },
          { label: "Total Ports", value: scan.totalPorts ?? 1024, color: "#a78bfa" },
        ].map((s) => (
          <div key={s.label}
            className="flex flex-col items-center py-3 rounded-2xl gap-1"
            style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <span style={{ fontSize: "20px", fontWeight: 700, color: s.color, fontFamily: "Inter" }}>{s.value}</span>
            <span style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter", textAlign: "center" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Risk pie chart */}
      {riskPie.length > 0 && (
        <div className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter", marginBottom: "12px" }}>
            Risk Distribution
          </p>
          <div className="flex items-center gap-4">
            <div style={{ width: "100px", height: "100px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskPie} cx="50%" cy="50%" innerRadius="50%" outerRadius="90%" dataKey="value" strokeWidth={0}>
                    {riskPie.map((r, i) => <Cell key={i} fill={r.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {riskPie.map((r) => (
                <div key={r.name} className="flex items-center gap-2">
                  <div className="rounded" style={{ width: "10px", height: "10px", background: r.color, flexShrink: 0, borderRadius: "3px" }} />
                  <span style={{ flex: 1, fontSize: "12px", color: "#6a8aaa", fontFamily: "Inter" }}>{r.name} Risk</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: r.color, fontFamily: "Inter" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation cards */}
      <div className="px-5 mb-4">
        <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Detailed Reports
        </p>
        <div className="flex flex-col gap-2.5">
          {[
            {
              icon: Activity,
              title: "Open Ports",
              desc: `${scan.openPorts ?? ports.length} ports found open`,
              color: "#f59e0b",
              badge: String(scan.openPorts ?? ports.length),
              path: "/app/scan/results/ports",
            },
            {
              icon: AlertTriangle,
              title: "Misconfigurations",
              desc: `${scan.misconfigurations ?? 0} issues detected`,
              color: "#ef4444",
              badge: String(scan.misconfigurations ?? 0),
              path: "/app/scan/results/misconfig",
            },
            {
              icon: Shield,
              title: "Risk Severity",
              desc: `${scoreInfo.label} — ${scan.riskScore}/100`,
              color: scoreInfo.color,
              badge: scoreInfo.label.split(" ")[0],
              path: "/app/scan/results/risk",
            },
            {
              icon: Server,
              title: "Services",
              desc: `${scan.servicesDetected ?? ports.length} active services detected`,
              color: "#38bdf8",
              badge: String(scan.servicesDetected ?? ports.length),
              path: "/app/scan/results/ports",
            },
          ].map((card) => (
            <motion.button
              key={card.title}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(card.path, { state: { scan } })}
              className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left"
              style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ width: "40px", height: "40px", background: `${card.color}12`, flexShrink: 0 }}
              >
                <card.icon size={20} style={{ color: card.color }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>{card.title}</p>
                <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{card.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded-lg"
                  style={{ background: `${card.color}15`, color: card.color, fontSize: "11px", fontWeight: 600, fontFamily: "Inter" }}
                >
                  {card.badge}
                </span>
                <ChevronRight size={15} style={{ color: "#3a5070" }} />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-5 flex gap-3">
        <button
          onClick={() => navigate("/app/scan/results/mitigation", { state: { scan } })}
          className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#f87171",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "Inter",
          }}
        >
          <Shield size={16} /> Fix Issues
        </button>
        <button
          onClick={() => navigate("/app/reports", { state: { scan } })}
          className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: "rgba(10,20,40,0.7)",
            border: "1px solid rgba(28,50,84,0.7)",
            color: "#8899b8",
            fontSize: "13px",
            fontWeight: 600,
            fontFamily: "Inter",
          }}
        >
          <FileText size={16} /> Export PDF
        </button>
      </div>
    </div>
  );
}
