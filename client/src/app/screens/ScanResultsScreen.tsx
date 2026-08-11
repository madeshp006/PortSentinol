import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Server,
  Shield, FileText, Clock, RefreshCw, TrendingUp, TrendingDown,
  Activity, Cpu, ExternalLink, Info, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { getRememberedScanId, hydrateScan, rememberCurrentScan } from "../utils/scanData";
import { AttackGraphView } from "../components/AttackGraphView";
import { DecoyDashboardView } from "../components/DecoyDashboardView";

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
  const [activeTab, setActiveTab] = useState<"external" | "credentialed">("external");
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const handleSimulatePath = (startHostId: string, startVulnerability: string) => {
    if (!token || !scan?.id) return;
    api.simulateAttackPath(token, scan.id, startHostId, startVulnerability)
      .then((res: any) => {
        if (res && res.simulation) {
          setSimulationResult(res.simulation);
        }
      })
      .catch((e) => console.log("Attack path simulation error:", e.message));
  };

  useEffect(() => {
    const passedScan = hydrateScan((location.state as any)?.scan);
    if (passedScan) {
      setScan(passedScan);
      rememberCurrentScan(passedScan);
      setLoading(false);
    } else if (token) {
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
    }
  }, [token, location.state]);

  // Load target scan history for line chart visualization (Stage 3)
  useEffect(() => {
    if (!token || !scan?.target) return;
    api.getScans(token)
      .then((allScans: any[]) => {
        const targetScans = allScans
          .filter((s) => s.target === scan.target && s.status === "completed")
          .sort((a, b) => new Date(a.requestedAt || a.createdAt).getTime() - new Date(b.requestedAt || b.createdAt).getTime());

        const formatted = targetScans.map((s, idx) => ({
          scanNum: `#${idx + 1}`,
          date: fmtDate(s.requestedAt || s.createdAt),
          score: Number(s.riskScore || 100),
          driftCount: Array.isArray(s.driftEvents) ? s.driftEvents.length : 0,
        }));
        setHistoryData(formatted);
      })
      .catch((e) => console.log("Load target history error:", e.message));
  }, [token, scan?.target]);

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
  const findings: any[] = scan.findings ?? [];
  const credentialedFindings: any[] = scan.credentialedFindings ?? findings.filter((f) => f.checkType === "credentialed_check" || f.source === "authenticated_ssh");
  const externalFindings: any[] = scan.externalFindings ?? findings.filter((f) => f.checkType !== "credentialed_check");
  const driftEvents: any[] = Array.isArray(scan.driftEvents) ? scan.driftEvents : [];
  
  const scoreInfo = getScoreLabel(scan.riskScore);

  // Severity counts
  const criticalCount = findings.filter((f) => (f.severity || f.risk) === "critical").length;
  const highCount = findings.filter((f) => (f.severity || f.risk) === "high").length;
  const mediumCount = findings.filter((f) => (f.severity || f.risk) === "medium").length;
  const lowCount = findings.filter((f) => (f.severity || f.risk) === "low").length;

  const highestThreat = findings.slice().sort((a, b) => {
    const order: any = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity || a.risk] ?? 9) - (order[b.severity || b.risk] ?? 9);
  })[0];

  // Trend direction
  const urgentOrHighDrift = driftEvents.filter((e) => e.priority === "urgent" || e.priority === "high");
  const isWorsening = urgentOrHighDrift.length > 0;
  const isImproving = driftEvents.some((e) => e.eventType === "CLOSED_PORT" || e.eventType === "RISK_DECREASED") && !isWorsening;

  const riskPie = [
    { name: "Critical", value: criticalCount, color: "#ef4444" },
    { name: "High", value: highCount, color: "#f97316" },
    { name: "Medium", value: mediumCount, color: "#f59e0b" },
    { name: "Low", value: lowCount, color: "#22c55e" },
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
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Security Posture Report</h2>
          <p style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "JetBrains Mono, monospace" }}>{scan.target}</p>
        </div>
        <button
          onClick={() => navigate("/app/reports", { state: { scan } })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "12px", fontFamily: "Inter" }}
        >
          <FileText size={13} /> Export PDF
        </button>
      </div>

      {/* STAGE 2: Target Executive Risk Posture Card */}
      <div className="mx-5 mb-4 rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #0d1f3c, #091528)", border: "1px solid rgba(28,50,84,0.8)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="relative flex items-center justify-center rounded-2xl"
              style={{ width: "72px", height: "72px", background: `${scoreInfo.color}15`, border: `2px solid ${scoreInfo.color}40` }}
            >
              <span style={{ fontSize: "26px", fontWeight: 800, color: scoreInfo.color, fontFamily: "Inter" }}>
                {scan.riskScore}
              </span>
            </div>
            <div>
              <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>Composite Security Score</p>
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

          {/* Trend Badge */}
          <div className="px-3 py-2 rounded-xl flex items-center gap-1.5 border" style={{ background: isWorsening ? "rgba(239,68,68,0.1)" : isImproving ? "rgba(34,197,94,0.1)" : "rgba(56,189,248,0.1)", borderColor: isWorsening ? "rgba(239,68,68,0.3)" : isImproving ? "rgba(34,197,94,0.3)" : "rgba(56,189,248,0.3)" }}>
            {isWorsening ? <TrendingDown size={16} style={{ color: "#ef4444" }} /> : isImproving ? <TrendingUp size={16} style={{ color: "#22c55e" }} /> : <Activity size={16} style={{ color: "#38bdf8" }} />}
            <div>
              <span style={{ fontSize: "9px", color: "#4a6080", display: "block", fontFamily: "Inter" }}>Posturing Trend</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: isWorsening ? "#ef4444" : isImproving ? "#22c55e" : "#38bdf8", fontFamily: "Inter" }}>
                {isWorsening ? "Worsened" : isImproving ? "Improving" : "Stable"}
              </span>
            </div>
          </div>
        </div>

        {/* Severity Band Counter Row */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3" style={{ borderTop: "1px solid rgba(28,50,84,0.6)" }}>
          <div className="text-center">
            <span style={{ fontSize: "9px", color: "#4a6080", fontFamily: "Inter", display: "block" }}>CRITICAL</span>
            <span style={{ fontSize: "16px", fontWeight: 700, color: criticalCount > 0 ? "#ef4444" : "#4a6080", fontFamily: "JetBrains Mono" }}>{criticalCount}</span>
          </div>
          <div className="text-center">
            <span style={{ fontSize: "9px", color: "#4a6080", fontFamily: "Inter", display: "block" }}>HIGH</span>
            <span style={{ fontSize: "16px", fontWeight: 700, color: highCount > 0 ? "#f97316" : "#4a6080", fontFamily: "JetBrains Mono" }}>{highCount}</span>
          </div>
          <div className="text-center">
            <span style={{ fontSize: "9px", color: "#4a6080", fontFamily: "Inter", display: "block" }}>MEDIUM</span>
            <span style={{ fontSize: "16px", fontWeight: 700, color: mediumCount > 0 ? "#f59e0b" : "#4a6080", fontFamily: "JetBrains Mono" }}>{mediumCount}</span>
          </div>
          <div className="text-center">
            <span style={{ fontSize: "9px", color: "#4a6080", fontFamily: "Inter", display: "block" }}>LOW</span>
            <span style={{ fontSize: "16px", fontWeight: 700, color: lowCount > 0 ? "#22c55e" : "#4a6080", fontFamily: "JetBrains Mono" }}>{lowCount}</span>
          </div>
        </div>

        {/* Highest Threat Highlight */}
        {highestThreat && (
          <div className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2" style={{ background: "rgba(7,13,30,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <AlertTriangle size={14} style={{ color: "#f97316", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#8899b8", fontFamily: "Inter" }} className="truncate">
              Highest Threat: <strong style={{ color: "#e8f0fe" }}>{highestThreat.title}</strong>
            </span>
          </div>
        )}
      </div>

      {/* STAGE 2: Prominent "Changes Since Last Scan" Top Panel */}
      {driftEvents.length > 0 ? (
        <div className="mx-5 mb-4 p-4 rounded-2xl" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} style={{ color: "#f59e0b" }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b", fontFamily: "Inter" }}>
                Changes Since Last Scan ({driftEvents.length} Drift Events)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-amber-400 border border-amber-500/30" style={{ fontSize: "10px", background: "rgba(245,158,11,0.1)", fontFamily: "Inter" }}>
              Action Needed
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {driftEvents.slice(0, 4).map((evt: any) => {
              const pColor = evt.priority === "urgent" ? "#ef4444" : evt.priority === "high" ? "#f97316" : "#38bdf8";
              return (
                <div key={evt.id || evt.explanation} className="p-3 rounded-xl flex items-start gap-2.5" style={{ background: "rgba(10,20,40,0.8)", border: `1px solid ${pColor}30` }}>
                  <span className="px-1.5 py-0.5 rounded font-mono font-bold uppercase" style={{ background: `${pColor}20`, color: pColor, fontSize: "9px", flexShrink: 0, marginTop: "1px" }}>
                    {evt.priority}
                  </span>
                  <p style={{ fontSize: "11px", color: "#d1d5db", fontFamily: "Inter", lineHeight: 1.4 }}>
                    {evt.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mx-5 mb-4 p-3.5 rounded-2xl flex items-center gap-3" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: "#86efac", fontFamily: "Inter" }}>
            No security state drift detected since your baseline scan. Target configuration remains stable.
          </span>
        </div>
      )}

      {/* STAGE 3: Historical Risk Score Timeline Chart */}
      {historyData.length > 1 && (
        <div className="mx-5 mb-4 p-4 rounded-2xl" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#c8d8f0", fontFamily: "Inter" }}>
              Target Historical Risk Score Trend
            </span>
            <span style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>
              {historyData.length} total scans tracked
            </span>
          </div>

          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <XAxis dataKey="scanNum" stroke="#4a6080" fontSize={10} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#4a6080" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0d1f3c", borderColor: "rgba(56,189,248,0.3)", borderRadius: "10px", color: "#fff", fontSize: "11px" }}
                />
                <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4, fill: "#38bdf8" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Subnet Attack Path Graph & Lateral Movement Simulation */}
      <AttackGraphView
        graph={scan.attackGraph || { target: scan.target, isSubnetScan: scan.target?.includes("/") || scan.target?.includes(",") }}
        onSimulatePath={handleSimulatePath}
        simulationResult={simulationResult}
      />

      {/* Deception-Based Detection Engine (Decoy & Honeypot Traps) */}
      <DecoyDashboardView token={token} />

      {/* STAGE 4: Tabbed Findings Section (External vs Credentialed) */}
      <div className="px-5 mb-4">
        <div className="flex rounded-xl p-1 mb-3" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
          <button
            onClick={() => setActiveTab("external")}
            className="flex-1 py-2 rounded-lg text-center font-semibold transition-all"
            style={{
              background: activeTab === "external" ? "rgba(56,189,248,0.15)" : "transparent",
              color: activeTab === "external" ? "#38bdf8" : "#4a6080",
              fontSize: "12px",
              fontFamily: "Inter",
            }}
          >
            🌐 External Findings ({externalFindings.length})
          </button>
          <button
            onClick={() => setActiveTab("credentialed")}
            className="flex-1 py-2 rounded-lg text-center font-semibold transition-all"
            style={{
              background: activeTab === "credentialed" ? "rgba(167,139,250,0.15)" : "transparent",
              color: activeTab === "credentialed" ? "#c084fc" : "#4a6080",
              fontSize: "12px",
              fontFamily: "Inter",
            }}
          >
            🔐 Internal Credentialed ({credentialedFindings.length})
          </button>
        </div>

        {/* Tab Content 1: External Findings */}
        {activeTab === "external" && (
          <div className="flex flex-col gap-2.5">
            {externalFindings.length === 0 ? (
              <div className="p-4 rounded-xl text-center" style={{ background: "rgba(10,20,40,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
                <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>No external perimeter findings detected.</p>
              </div>
            ) : (
              externalFindings.map((f: any) => (
                <motion.button
                  key={f.code || f.title}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/app/scan/results/ports/${encodeURIComponent(f.code || f.port || 0)}`, { state: { scan } })}
                  className="p-4 rounded-2xl text-left w-full flex flex-col gap-2"
                  style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
                      {f.title}
                    </span>
                    <span className="px-2 py-0.5 rounded uppercase font-mono font-bold" style={{ fontSize: "10px", background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
                      {f.severity || "medium"}
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "#8899b8", fontFamily: "Inter", lineHeight: 1.4 }}>
                    {f.recommendation || f.description}
                  </p>
                </motion.button>
              ))
            )}
          </div>
        )}

        {/* Tab Content 2: Credentialed Findings & Opt-In CTA */}
        {activeTab === "credentialed" && (
          <div>
            {credentialedFindings.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {credentialedFindings.map((f: any) => (
                  <div key={f.code || f.title} className="p-4 rounded-2xl text-left flex flex-col gap-2" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.25)" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu size={15} style={{ color: "#c084fc" }} />
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
                          {f.title}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded uppercase font-mono font-bold" style={{ fontSize: "10px", background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                        {f.severity || "high"}
                      </span>
                    </div>
                    <p style={{ fontSize: "11px", color: "#cbd5e1", fontFamily: "Inter", lineHeight: 1.4 }}>
                      {f.description}
                    </p>
                    <div className="p-2.5 rounded-xl mt-1" style={{ background: "rgba(7,13,30,0.6)", border: "1px solid rgba(28,50,84,0.5)" }}>
                      <span style={{ fontSize: "10px", color: "#22c55e", fontFamily: "Inter", fontWeight: 600 }}>Fix Recommendation: </span>
                      <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "Inter" }}>{f.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Opt-In Call-to-Action Card */
              <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <div className="flex items-start gap-3">
                  <Cpu size={20} style={{ color: "#c084fc", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
                      Deep Internal Configuration Checks Available
                    </h4>
                    <p style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "Inter", lineHeight: 1.5, marginTop: "4px" }}>
                      Unauthenticated scanning only checks externally exposed ports. Opt into <strong>Credentialed SSH Scanning</strong> on your next scan run to audit <code className="text-purple-300">sshd_config</code>, root login settings, and Linux permission bits internally.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/app/scan")}
                  className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2"
                  style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#c084fc", fontSize: "12px", fontWeight: 600, fontFamily: "Inter" }}
                >
                  Run Credentialed Audit Scan <ArrowUpRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-5 flex gap-3">
        <button
          onClick={() => navigate("/app/scan/results/mitigation", { state: { scan } })}
          className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: "13px", fontWeight: 600, fontFamily: "Inter" }}
        >
          <Shield size={16} /> Fix Issues
        </button>
        <button
          onClick={() => navigate("/app/reports", { state: { scan } })}
          className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)", color: "#8899b8", fontSize: "13px", fontWeight: 600, fontFamily: "Inter" }}
        >
          <FileText size={16} /> Export PDF
        </button>
      </div>
    </div>
  );
}
