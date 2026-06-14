import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { motion } from "motion/react";
import {
  ChevronLeft, Shield, ExternalLink, Copy, AlertTriangle,
  Server, Lock, Unlock, Activity, BookOpen, RefreshCw,
} from "lucide-react";
import { type RiskLevel } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { safeCopy } from "../utils/clipboard";
import { getRememberedScanId, hydrateScan, rememberCurrentScan } from "../utils/scanData";

const riskDot: Record<RiskLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
  info: "#3b82f6",
};

export function ServiceDetailsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
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

  const port = useMemo(() => {
    const ports = scan?.ports ?? [];
    return ports.find((p: any) => p.id === id || String(p.number) === id) || null;
  }, [scan, id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "780px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={26} style={{ color: "#38bdf8" }} />
        </motion.div>
        <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>Loading service details...</p>
      </div>
    );
  }

  if (!port) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-8" style={{ minHeight: "780px" }}>
        <Server size={40} style={{ color: "#2a3f5e" }} strokeWidth={1.5} />
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#4a6080", fontFamily: "Inter", textAlign: "center" }}>
          Service details are not available for this port.
        </p>
        <button
          onClick={() => navigate("/app/scan/results/ports", { state: scan ? { scan } : undefined })}
          className="px-6 py-3 rounded-2xl"
          style={{ background: "linear-gradient(135deg,#0e6bb0,#0a4f8a)", color: "#e8f4ff", fontSize: "14px", fontWeight: 600, fontFamily: "Inter" }}
        >
          Back to Open Ports
        </button>
      </div>
    );
  }

  const riskColor = riskDot[port.risk as RiskLevel];

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      <div
        className="px-5 pt-4 pb-5"
        style={{
          background: `linear-gradient(180deg, ${riskColor}15 0%, transparent 100%)`,
          borderBottom: `1px solid ${riskColor}20`,
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/app/scan/results/ports", { state: scan ? { scan } : undefined })}
            className="flex items-center justify-center rounded-xl"
            style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
          >
            <ChevronLeft size={18} style={{ color: "#8899b8" }} />
          </button>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#8899b8", fontFamily: "Inter" }}>Service Details</span>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center rounded-2xl" style={{ width: "64px", height: "64px", background: `${riskColor}15`, border: `1.5px solid ${riskColor}35` }}>
            <Server size={28} style={{ color: riskColor }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>{port.service}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono px-2 py-0.5 rounded" style={{ background: "rgba(28,50,84,0.8)", color: "#38bdf8", fontSize: "13px" }}>
                Port {port.number}
              </span>
              <span className="px-2 py-0.5 rounded" style={{ background: "rgba(28,50,84,0.6)", color: "#4a6080", fontSize: "11px", fontFamily: "Inter" }}>
                {port.protocol}
              </span>
              <span className="px-2 py-0.5 rounded capitalize border" style={{ background: `${riskColor}12`, color: riskColor, borderColor: `${riskColor}30`, fontSize: "11px", fontWeight: 600, fontFamily: "Inter" }}>
                {port.risk}
              </span>
            </div>
          </div>
        </div>
      </div>

      {port.banner && (
        <div className="mx-5 mt-4 mb-2 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(4,8,20,0.8)", border: "1px solid rgba(28,50,84,0.7)" }}>
          <Activity size={13} style={{ color: "#22c55e", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: "12px", color: "#22c55e", fontFamily: "JetBrains Mono, monospace" }}>{port.banner}</span>
          <button onClick={() => safeCopy(port.banner || "")}>
            <Copy size={13} style={{ color: "#3a5070" }} />
          </button>
        </div>
      )}

      <div className="mx-5 mt-3 mb-4 px-4 py-4 rounded-2xl" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={14} style={{ color: "#4a6080" }} />
          <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px" }}>About This Service</span>
        </div>
        <p style={{ fontSize: "13px", color: "#8899b8", fontFamily: "Inter", lineHeight: 1.6 }}>{port.description}</p>
      </div>

      <div className="mx-5 mb-4">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "State", value: String(port.state).toUpperCase(), icon: port.state === "open" ? Unlock : Lock, iconColor: port.state === "open" ? "#ef4444" : "#22c55e" },
            { label: "Protocol", value: port.protocol, icon: Activity, iconColor: "#38bdf8" },
            { label: "Risk Level", value: port.risk.charAt(0).toUpperCase() + port.risk.slice(1), icon: AlertTriangle, iconColor: riskColor },
            { label: "CVEs", value: port.cve?.length ? `${port.cve.length} known` : "None", icon: Shield, iconColor: port.cve?.length ? "#f97316" : "#22c55e" },
          ].map((info) => (
            <div key={info.label} className="px-4 py-3 rounded-2xl flex items-center gap-3" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <div className="flex items-center justify-center rounded-lg" style={{ width: "32px", height: "32px", background: `${info.iconColor}12` }}>
                <info.icon size={15} style={{ color: info.iconColor }} />
              </div>
              <div>
                <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter", textTransform: "uppercase" }}>{info.label}</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>{info.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {port.cve && port.cve.length > 0 && (
        <div className="mx-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} style={{ color: "#f97316" }} />
            <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px" }}>Known CVEs</span>
          </div>
          <div className="flex flex-col gap-2">
            {port.cve.map((cve: string) => (
              <div key={cve} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                <div className="rounded-full" style={{ width: "6px", height: "6px", background: "#f97316", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "13px", color: "#f97316", fontFamily: "JetBrains Mono, monospace" }}>{cve}</span>
                <ExternalLink size={13} style={{ color: "#3a5070" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 flex gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/app/scan/results/mitigation", { state: scan ? { scan } : undefined })}
          className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: `${riskColor}18`, border: `1px solid ${riskColor}30`, color: riskColor, fontSize: "13px", fontWeight: 600, fontFamily: "Inter" }}
        >
          <Shield size={16} /> View Fix
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/app/scan/results/risk", { state: scan ? { scan } : undefined })}
          className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)", color: "#8899b8", fontSize: "13px", fontWeight: 600, fontFamily: "Inter" }}
        >
          <AlertTriangle size={16} /> Risk Analysis
        </motion.button>
      </div>
    </div>
  );
}
