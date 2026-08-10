import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { motion } from "motion/react";
import {
  ChevronLeft, Shield, ExternalLink, Copy, AlertTriangle,
  Server, Lock, Unlock, Activity, BookOpen, RefreshCw, Cpu, CheckCircle2,
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
    const allFindings = scan?.findings ?? [];
    
    // Check if id matches a finding code first
    const matchFinding = allFindings.find((f: any) => f.code === id);
    if (matchFinding) {
      return {
        id: matchFinding.code,
        number: matchFinding.port || 0,
        port: matchFinding.port || 0,
        service: matchFinding.service || matchFinding.product || "service",
        protocol: "tcp",
        state: "open",
        product: matchFinding.product || "Unknown",
        version: matchFinding.version || "Unknown",
        risk: matchFinding.severity || matchFinding.risk || "medium",
        cve: matchFinding.cve || [],
        cveStatus: matchFinding.cveStatus,
        riskDetails: matchFinding.riskDetails,
        mitigation: matchFinding.recommendation || matchFinding.mitigation,
        checkType: matchFinding.checkType,
        source: matchFinding.source,
        description: matchFinding.description,
        banner: matchFinding.banner || "",
      };
    }

    // Check matching port object
    const matchPort = ports.find((p: any) => p.id === id || String(p.number ?? p.port ?? "") === String(id));
    if (matchPort) return matchPort;

    // Fallback: match finding by port number string
    const matchFindingByPort = allFindings.find((f: any) => String(f.port) === String(id));
    if (matchFindingByPort) {
      return {
        id: matchFindingByPort.code,
        number: matchFindingByPort.port || 0,
        port: matchFindingByPort.port || 0,
        service: matchFindingByPort.service || matchFindingByPort.product || "service",
        protocol: "tcp",
        state: "open",
        product: matchFindingByPort.product || "Unknown",
        version: matchFindingByPort.version || "Unknown",
        risk: matchFindingByPort.severity || matchFindingByPort.risk || "medium",
        cve: matchFindingByPort.cve || [],
        cveStatus: matchFindingByPort.cveStatus,
        riskDetails: matchFindingByPort.riskDetails,
        mitigation: matchFindingByPort.recommendation || matchFindingByPort.mitigation,
        checkType: matchFindingByPort.checkType,
        source: matchFindingByPort.source,
        description: matchFindingByPort.description,
        banner: matchFindingByPort.banner || "",
      };
    }

    return null;
  }, [scan, id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "780px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={26} style={{ color: "#38bdf8" }} />
        </motion.div>
        <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>Loading finding details...</p>
      </div>
    );
  }

  if (!port) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-8" style={{ minHeight: "780px" }}>
        <Server size={40} style={{ color: "#2a3f5e" }} strokeWidth={1.5} />
        <p style={{ fontSize: "15px", fontWeight: 600, color: "#4a6080", fontFamily: "Inter", textAlign: "center" }}>
          Finding details are not available for this target port.
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

  const riskColor = riskDot[(port.risk || "medium") as RiskLevel] || "#f59e0b";
  const isCredentialed = port.checkType === "credentialed_check" || port.source === "authenticated_ssh";
  const cveList = Array.isArray(port.cve) ? port.cve : [];
  const riskDetails = port.riskDetails || {};
  const isFallbackScoring = riskDetails.scoringMethod === "fallback_static" || port.cveStatus === "no_version" || cveList.length === 0;

  // Extract score breakdown values
  const epssProb = Number(riskDetails.epssProb || 0);
  const epssPercent = (epssProb * 100).toFixed(1);
  const cvssBase = Number(riskDetails.cvssBase || 0);
  const exposureWeight = Number(riskDetails.exposureWeight || 0.8);
  const compositeScore = Number(riskDetails.compositeScore || 0.35).toFixed(4);

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      {/* Header with Risk Accent */}
      <div
        className="px-5 pt-4 pb-5"
        style={{
          background: `linear-gradient(180deg, ${riskColor}18 0%, transparent 100%)`,
          borderBottom: `1px solid ${riskColor}25`,
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/app/scan/results", { state: scan ? { scan } : undefined })}
            className="flex items-center justify-center rounded-xl"
            style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
          >
            <ChevronLeft size={18} style={{ color: "#8899b8" }} />
          </button>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#8899b8", fontFamily: "Inter" }}>
            Finding Deep-Dive Analysis
          </span>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center rounded-2xl" style={{ width: "64px", height: "64px", background: `${riskColor}15`, border: `1.5px solid ${riskColor}35`, flexShrink: 0 }}>
            {isCredentialed ? <Cpu size={28} style={{ color: riskColor }} /> : <Server size={28} style={{ color: riskColor }} />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }} className="truncate">
              {port.product && port.product !== "Unknown" ? port.product : (port.service || "Service")}
            </h1>
            <p style={{ fontSize: "12px", color: "#38bdf8", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
              Version: {port.version || "Unknown"}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-mono px-2 py-0.5 rounded" style={{ background: "rgba(28,50,84,0.8)", color: "#c8d8f0", fontSize: "11px" }}>
                Port {port.number || port.port}
              </span>
              <span className="px-2 py-0.5 rounded capitalize border" style={{ background: `${riskColor}12`, color: riskColor, borderColor: `${riskColor}30`, fontSize: "11px", fontWeight: 600, fontFamily: "Inter" }}>
                {(port.risk || "medium").toUpperCase()} SEVERITY
              </span>
              {/* Origin Badge */}
              <span className="px-2 py-0.5 rounded border" style={{ background: isCredentialed ? "rgba(167,139,250,0.12)" : "rgba(56,189,248,0.12)", color: isCredentialed ? "#c084fc" : "#38bdf8", borderColor: isCredentialed ? "rgba(167,139,250,0.3)" : "rgba(56,189,248,0.3)", fontSize: "10px", fontWeight: 600, fontFamily: "Inter" }}>
                {isCredentialed ? "🔐 Credentialed SSH Audit" : "🌐 External Unauthenticated Scan"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner / Raw Signal */}
      {port.banner && (
        <div className="mx-5 mt-4 mb-2 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(4,8,20,0.8)", border: "1px solid rgba(28,50,84,0.7)" }}>
          <Activity size={13} style={{ color: "#22c55e", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: "11px", color: "#22c55e", fontFamily: "JetBrains Mono, monospace" }} className="truncate">
            {port.banner}
          </span>
          <button onClick={() => safeCopy(port.banner || "")}>
            <Copy size={13} style={{ color: "#3a5070" }} />
          </button>
        </div>
      )}

      {/* 3-Factor Risk Score Breakdown Card */}
      <div className="mx-5 mt-3 mb-4 p-4 rounded-2xl" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield size={16} style={{ color: riskColor }} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#e8f4ff", fontFamily: "Inter" }}>
              Composite Risk Score: {compositeScore}
            </span>
          </div>
          {isFallbackScoring && (
            <span className="px-2 py-0.5 rounded text-amber-400 border border-amber-500/30" style={{ fontSize: "10px", background: "rgba(245,158,11,0.1)", fontFamily: "Inter" }}>
              ⚠️ Static Fallback Scoring Used
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-xl" style={{ background: "rgba(7,13,30,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <span style={{ fontSize: "9px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", display: "block" }}>EPSS Weight (50%)</span>
            <span style={{ fontSize: "15px", fontWeight: 700, color: epssProb > 0.3 ? "#ef4444" : "#22c55e", fontFamily: "JetBrains Mono, monospace" }}>
              {epssPercent}%
            </span>
            <span style={{ fontSize: "8px", color: "#3a5070", display: "block" }}>30-day exploit chance</span>
          </div>
          <div className="p-2.5 rounded-xl" style={{ background: "rgba(7,13,30,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <span style={{ fontSize: "9px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", display: "block" }}>CVSS Base (30%)</span>
            <span style={{ fontSize: "15px", fontWeight: 700, color: cvssBase >= 7 ? "#f97316" : "#38bdf8", fontFamily: "JetBrains Mono, monospace" }}>
              {cvssBase > 0 ? cvssBase : "N/A"}
            </span>
            <span style={{ fontSize: "8px", color: "#3a5070", display: "block" }}>Base severity rating</span>
          </div>
          <div className="p-2.5 rounded-xl" style={{ background: "rgba(7,13,30,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <span style={{ fontSize: "9px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", display: "block" }}>Exposure (20%)</span>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#a78bfa", fontFamily: "JetBrains Mono, monospace" }}>
              {exposureWeight}
            </span>
            <span style={{ fontSize: "8px", color: "#3a5070", display: "block" }}>Port sensitivity weight</span>
          </div>
        </div>
      </div>

      {/* Matched Known CVEs Section */}
      {cveList.length > 0 && (
        <div className="mx-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} style={{ color: "#f97316" }} />
            <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Matched Known Vulnerabilities ({cveList.length} CVEs)
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {cveList.map((cveObj: any, idx: number) => {
              const cveId = typeof cveObj === "string" ? cveObj : (cveObj.id || `CVE-${idx}`);
              const summary = typeof cveObj === "object" ? cveObj.summary : "";
              const cvss = typeof cveObj === "object" ? cveObj.cvss : null;
              const epssVal = typeof cveObj === "object" && cveObj.epss ? (cveObj.epss * 100).toFixed(1) : null;
              const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`;

              return (
                <div key={cveId} className="p-3.5 rounded-xl flex flex-col gap-2" style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#f97316", fontFamily: "JetBrains Mono, monospace" }}>{cveId}</span>
                      {cvss && (
                        <span className="px-1.5 py-0.5 rounded text-amber-300 font-mono" style={{ fontSize: "10px", background: "rgba(249,115,22,0.15)" }}>
                          CVSS {cvss}
                        </span>
                      )}
                      {epssVal && (
                        <span className="px-1.5 py-0.5 rounded text-red-300 font-mono" style={{ fontSize: "10px", background: "rgba(239,68,68,0.15)" }}>
                          EPSS {epssVal}%
                        </span>
                      )}
                    </div>
                    <a href={nvdUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-400 hover:underline" style={{ fontSize: "11px", fontFamily: "Inter" }}>
                      NVD Link <ExternalLink size={12} />
                    </a>
                  </div>
                  {summary && (
                    <p style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "Inter", lineHeight: 1.4 }}>
                      {summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic Remediation Card */}
      <div className="mx-5 mb-5 p-4 rounded-2xl" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 size={15} style={{ color: "#22c55e" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e", fontFamily: "Inter" }}>
            CVE-Aware Dynamic Remediation
          </span>
        </div>
        <p style={{ fontSize: "12px", color: "#d1d5db", fontFamily: "Inter", lineHeight: 1.5 }}>
          {port.mitigation || port.recommendation || `Review port ${port.number || port.port} configuration and restrict unauthorized exposure.`}
        </p>
      </div>

      {/* Navigation Actions */}
      <div className="px-5 flex gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/app/scan/results/mitigation", { state: scan ? { scan } : undefined })}
          className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: `${riskColor}18`, border: `1px solid ${riskColor}30`, color: riskColor, fontSize: "13px", fontWeight: 600, fontFamily: "Inter" }}
        >
          <Shield size={16} /> All Mitigations
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
