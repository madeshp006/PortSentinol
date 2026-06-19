import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import {
  ChevronLeft, AlertTriangle, Shield, TrendingDown, Info, RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { getRememberedScanId, hydrateScan, rememberCurrentScan } from "../utils/scanData";

function scoreLabel(score: number) {
  if (score >= 80) return { label: "LOW RISK", color: "#22c55e" };
  if (score >= 60) return { label: "MODERATE RISK", color: "#f59e0b" };
  if (score >= 40) return { label: "HIGH RISK", color: "#f97316" };
  return { label: "CRITICAL RISK", color: "#ef4444" };
}

export function RiskSeverityScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [scan, setScan] = useState<any>(hydrateScan((location.state as any)?.scan));
  const [loading, setLoading] = useState(!(location.state as any)?.scan);

  useEffect(() => {
    const passedScan = hydrateScan((location.state as any)?.scan);
    if (passedScan) {
      setScan(passedScan);
      rememberCurrentScan(passedScan);
      setLoading(false);
      return;
    }
    if (!token) return;

    const rememberedId = getRememberedScanId();
    setLoading(true);
    const loader = rememberedId ? api.getScan(token, rememberedId).catch(() => null) : Promise.resolve(null);
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
      .finally(() => setLoading(false));
  }, [location.state, token]);

  const scanPorts: any[] = scan?.ports ?? [];
  const riskBreakdown = useMemo(() => {
    return scanPorts
      .sort((a, b) => {
        const order = ["critical", "high", "medium", "low"];
        return order.indexOf(a.risk) - order.indexOf(b.risk);
      })
      .map((p) => ({
        label: `${p.service} :${p.number}`,
        port: p.number,
        severity:
          p.risk === "critical" ? 95
          : p.risk === "high" ? 78
          : p.risk === "medium" ? 55
          : 24,
        color:
          p.risk === "critical" ? "#ef4444"
          : p.risk === "high" ? "#f97316"
          : p.risk === "medium" ? "#f59e0b"
          : "#22c55e",
        level:
          p.risk === "critical" ? "Critical"
          : p.risk === "high" ? "High"
          : p.risk === "medium" ? "Medium"
          : "Low",
      }));
  }, [scanPorts]);

  const barData = [
    { name: "Critical", value: riskBreakdown.filter((r) => r.level === "Critical").length, color: "#ef4444" },
    { name: "High", value: riskBreakdown.filter((r) => r.level === "High").length, color: "#f97316" },
    { name: "Medium", value: riskBreakdown.filter((r) => r.level === "Medium").length, color: "#f59e0b" },
    { name: "Low", value: riskBreakdown.filter((r) => r.level === "Low").length, color: "#22c55e" },
  ].filter((b) => b.value > 0);

  const radarData = [
    { subject: "Exposure", A: Math.max(10, 100 - (scan?.riskScore ?? 100)) },
    { subject: "Services", A: Math.min(100, (scan?.servicesDetected ?? 0) * 12) },
    { subject: "Ports", A: Math.min(100, (scan?.openPorts ?? 0) * 12) },
    { subject: "Findings", A: Math.min(100, (scan?.misconfigurations ?? 0) * 18) },
    { subject: "Network", A: Math.min(100, (scan?.totalPorts ?? 0) > 1000 ? 65 : 35) },
    { subject: "Hardening", A: Math.max(10, scan?.riskScore ?? 100) },
  ];

  const levelInfo = [
    {
      level: "Critical",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.2)",
      count: riskBreakdown.filter((r) => r.level === "Critical").length,
      desc: "Immediate action required. These services present the highest likelihood of compromise.",
    },
    {
      level: "High",
      color: "#f97316",
      bg: "rgba(249,115,22,0.08)",
      border: "rgba(249,115,22,0.2)",
      count: riskBreakdown.filter((r) => r.level === "High").length,
      desc: "Address quickly. These findings expand the attack surface significantly.",
    },
    {
      level: "Medium",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.2)",
      count: riskBreakdown.filter((r) => r.level === "Medium").length,
      desc: "Plan remediation soon. These issues weaken your security posture over time.",
    },
    {
      level: "Low",
      color: "#22c55e",
      bg: "rgba(34,197,94,0.08)",
      border: "rgba(34,197,94,0.2)",
      count: riskBreakdown.filter((r) => r.level === "Low").length,
      desc: "Monitor and improve when convenient. These findings are informational or low priority.",
    },
  ].filter((item) => item.count > 0);

  const scoreInfo = scoreLabel(scan?.riskScore ?? 100);
  const denominator = Math.max(1, riskBreakdown.length);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "780px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={26} style={{ color: "#38bdf8" }} />
        </motion.div>
        <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>Loading risk analysis...</p>
      </div>
    );
  }

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      <div className="px-5 pt-4 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/app/scan/results", { state: scan ? { scan } : undefined })}
          className="flex items-center justify-center rounded-xl"
          style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Risk Analysis</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>Severity breakdown · {riskBreakdown.length} exposed service{riskBreakdown.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${scoreInfo.color}18, rgba(10,20,40,0.45))`, border: `1px solid ${scoreInfo.color}25` }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-2xl" style={{ width: "52px", height: "52px", background: `${scoreInfo.color}18`, border: `1px solid ${scoreInfo.color}25` }}>
            <AlertTriangle size={24} style={{ color: scoreInfo.color }} strokeWidth={1.5} />
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>Overall Risk Level</p>
            <p style={{ fontSize: "20px", fontWeight: 700, color: scoreInfo.color, fontFamily: "Inter" }}>{scoreInfo.label}</p>
          </div>
          <div className="ml-auto text-right">
            <p style={{ fontSize: "30px", fontWeight: 800, color: scoreInfo.color, fontFamily: "Inter" }}>{scan?.riskScore ?? 100}</p>
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>/ 100 score</p>
          </div>
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter", marginBottom: "12px" }}>Findings by Severity</p>
        <div style={{ height: "120px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barSize={36} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#4a6080", fontSize: 11, fontFamily: "Inter" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#4a6080", fontSize: 10 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{barData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter", marginBottom: "12px" }}>Exposure Radar</p>
        <div style={{ height: "180px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="rgba(74,96,128,0.35)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#4a6080", fontSize: 10, fontFamily: "Inter" }} />
              <Radar dataKey="A" fill="#38bdf8" fillOpacity={0.3} stroke="#38bdf8" strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="px-5 mb-4">
        <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Severity Breakdown</p>
        <div className="flex flex-col gap-2.5">
          {levelInfo.map((l, i) => (
            <motion.div key={l.level} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="px-4 py-3.5 rounded-2xl" style={{ background: l.bg, border: `1px solid ${l.border}` }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-full" style={{ width: "8px", height: "8px", background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: l.color, fontFamily: "Inter", flex: 1 }}>{l.level}</span>
                <span className="px-2 py-0.5 rounded-lg" style={{ background: `${l.color}20`, color: l.color, fontSize: "12px", fontWeight: 700, fontFamily: "Inter" }}>{l.count}</span>
              </div>
              <div className="rounded-full mb-2" style={{ height: "4px", background: "rgba(28,50,84,0.6)" }}>
                <div className="rounded-full h-full" style={{ width: `${(l.count / denominator) * 100}%`, background: l.color }} />
              </div>
              <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", lineHeight: 1.5 }}>{l.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>Top Exposed Services</p>
          <Info size={14} style={{ color: "#4a6080" }} />
        </div>
        <div className="flex flex-col gap-2">
          {riskBreakdown.slice(0, 6).map((v) => (
            <div key={v.label} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "rgba(10,20,40,0.6)", border: "1px solid rgba(28,50,84,0.5)" }}>
              <span className="font-mono text-center rounded" style={{ width: "36px", fontSize: "11px", color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "2px 4px" }}>:{v.port}</span>
              <span style={{ flex: 1, fontSize: "12px", color: "#8899b8", fontFamily: "Inter" }}>{v.label}</span>
              <div className="flex items-center gap-2">
                <div className="rounded-full" style={{ width: "50px", height: "4px", background: "rgba(28,50,84,0.6)" }}>
                  <div className="rounded-full h-full" style={{ width: `${v.severity}%`, background: v.color }} />
                </div>
                <span style={{ fontSize: "11px", color: v.color, fontFamily: "Inter", width: "26px" }}>{v.severity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 flex gap-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/app/scan/results/mitigation", { state: scan ? { scan } : undefined })} className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #0e6bb0, #0a4f8a)", border: "1px solid rgba(56,189,248,0.3)", color: "#e8f4ff", fontSize: "13px", fontWeight: 600, fontFamily: "Inter" }}>
          <TrendingDown size={16} /> Mitigate All
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/app/scan/results/misconfig", { state: scan ? { scan } : undefined })} className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)", color: "#8899b8", fontSize: "13px", fontWeight: 600, fontFamily: "Inter" }}>
          <AlertTriangle size={16} /> View Issues
        </motion.button>
      </div>
    </div>
  );
}
