import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ChevronLeft, Radar, Target, Info,
  Zap, Settings2, RefreshCw, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

const scanTypes = [
  { id: "quick", label: "Quick Scan", icon: Zap, desc: "Core validation workflow, ~2 min", color: "#38bdf8" },
  { id: "deep", label: "Deep Scan", icon: Radar, desc: "Extended workflow for approved targets", color: "#a78bfa" },
  { id: "custom", label: "Custom", icon: Settings2, desc: "Use a custom internal port range", color: "#22c55e" },
];

const privatePatterns = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function isIpv4(target: string) {
  return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(target);
}

function isPrivateTarget(target = "") {
  const t = String(target || "").trim().toLowerCase();
  if (t === "localhost" || t === "127.0.0.1") {
    return true;
  }
  if (t.endsWith(".local")) {
    return true;
  }
  if (isIpv4(t)) {
    const [addr] = t.split("/");
    return privatePatterns.some((pattern) => pattern.test(addr));
  }
  return false;
}

function fmtAgo(iso: string) {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}

export function ScanTargetScreen() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("quick");
  const [portRange, setPortRange] = useState("1-1000");
  const [inputFocus, setInputFocus] = useState(false);
  const [recentTargets, setRecentTargets] = useState<{ target: string; scanType: string; time: string; status: string }[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [scannerMode, setScannerMode] = useState("local");

  useEffect(() => {
    if (!token) return;
    api.getQueueState(token)
      .then((state) => {
        if (state && state.scannerMode) {
          setScannerMode(state.scannerMode);
        }
      })
      .catch((e) => console.log("Load queue state error:", e.message));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoadingAgents(true);
    api.getAgents(token)
      .then((data) => {
        setAgents(data);
        const onlineAgents = data.filter((a) => a.status === "online");
        if (onlineAgents.length > 0) {
          setSelectedAgentId(onlineAgents[0].id || onlineAgents[0].agentId);
        }
      })
      .catch((e) => console.log("Load agents error:", e.message))
      .finally(() => setLoadingAgents(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.getScans(token)
      .then((scans: any[]) => {
        const seen = new Set<string>();
        const unique: { target: string; scanType: string; time: string; status: string }[] = [];
        for (const s of scans) {
          if (!seen.has(s.target)) {
            seen.add(s.target);
            unique.push({
              target: s.target,
              scanType: s.scanType || "Quick Scan",
              time: fmtAgo(s.savedAt || s.timestamp || s.requestedAt),
              status: s.status || "completed",
            });
          }
          if (unique.length >= 3) break;
        }
        setRecentTargets(unique);
      })
      .catch((e) => console.log("Load recent targets error:", e.message))
      .finally(() => setLoadingRecent(false));
  }, [token]);

  const handleScan = () => {
    if (!target.trim()) return;
    const isPrivate = isPrivateTarget(target);
    navigate("/app/scan/progress", {
      state: {
        target: target.trim(),
        scanType,
        portRange,
        agentId: isPrivate ? selectedAgentId : undefined,
      },
    });
  };

  const isPrivate = isPrivateTarget(target);
  const onlineAgents = agents.filter((a) => a.status === "online");
  const hasOnlineAgents = onlineAgents.length > 0;
  const cannotScan = isPrivate && scannerMode === "agent" && !hasOnlineAgents;

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      <div className="px-5 pt-4 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/app")} className="flex items-center justify-center rounded-xl" style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>New Scan</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>Authorized internal assessment workflow</p>
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.18)" }}>
        <Info size={14} style={{ color: "#38bdf8", flexShrink: 0, marginTop: "1px" }} />
        <div>
          <p style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "Inter", fontWeight: 600, marginBottom: "2px" }}>Production-style workflow</p>
          <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", lineHeight: 1.5 }}>
            This build only accepts <span style={{ color: "#c8d8f0", fontFamily: "JetBrains Mono, monospace" }}>localhost</span>, <span style={{ color: "#c8d8f0", fontFamily: "JetBrains Mono, monospace" }}>private IPv4 ranges</span>, and <span style={{ color: "#c8d8f0", fontFamily: "JetBrains Mono, monospace" }}>.local</span> hosts. Real scan output requires your approved internal scanner endpoint. Without that endpoint, the app runs in safe demo mode while keeping the full job workflow.
          </p>
        </div>
      </div>

      <div className="px-5 mb-5">
        <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Scan Target</p>
        <div style={{ border: inputFocus ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(28,50,84,0.8)", borderRadius: "16px", background: "rgba(10,20,40,0.8)", transition: "border-color 0.2s", boxShadow: inputFocus ? "0 0 0 3px rgba(56,189,248,0.08)" : "none", position: "relative" }}>
          <Target size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#4a6080" }} />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onFocus={() => setInputFocus(true)}
            onBlur={() => setInputFocus(false)}
            onKeyDown={(e) => e.key === "Enter" && !cannotScan && handleScan()}
            placeholder="e.g. 127.0.0.1 or 192.168.1.0/24"
            style={{ background: "transparent", border: "none", outline: "none", color: "#c8d8f0", fontSize: "14px", fontFamily: "JetBrains Mono, monospace", padding: "14px 16px 14px 42px", width: "100%" }}
          />
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {["127.0.0.1", "192.168.1.0/24", "10.0.0.10", "device.local"].map((t) => (
            <button key={t} onClick={() => setTarget(t)} className="px-3 py-1.5 rounded-lg" style={{ background: target === t ? "rgba(56,189,248,0.1)" : "rgba(10,20,40,0.6)", border: target === t ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(28,50,84,0.6)", color: target === t ? "#38bdf8" : "#4a6080", fontSize: "10px", fontFamily: "JetBrains Mono, monospace", transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Agent selection for private network scan targets */}
        {isPrivate && scannerMode === "agent" && (
          <div className="mt-3">
            {hasOnlineAgents ? (
              <div className="p-3.5 rounded-2xl" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(56,189,248,0.3)" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "#38bdf8", marginBottom: "6px", fontFamily: "Inter" }}>
                  Select PortSentinel Agent for Private Scan
                </p>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(7,13,30,0.9)",
                    border: "1px solid rgba(28,50,84,0.8)",
                    borderRadius: "12px",
                    color: "#c8d8f0",
                    padding: "10px 12px",
                    fontSize: "12px",
                    outline: "none",
                    fontFamily: "Inter"
                  }}
                >
                  {onlineAgents.map((agent) => (
                    <option key={agent.id || agent.agentId} value={agent.id || agent.agentId}>
                      {agent.name} ({agent.deviceName} - {agent.operatingSystem})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-4 rounded-2xl flex flex-col gap-2.5" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={15} style={{ color: "#ef4444", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#ef4444", fontFamily: "Inter" }}>
                      Private network scanning requires an active agent
                    </p>
                    <p style={{ fontSize: "10px", color: "#8a9bb0", fontFamily: "Inter", lineHeight: 1.4, marginTop: "2px" }}>
                      To scan a private network target like <code className="text-red-400 font-mono">{target}</code>, you must have a local agent running. We detected no active agents online.
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => navigate("/app/agents")}
                  className="w-full py-2 rounded-xl text-center"
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#fca5a5",
                    fontSize: "11px",
                    fontWeight: 600,
                    fontFamily: "Inter"
                  }}
                >
                  Configure & Run Local Agent
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 mb-5">
        <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Scan Type</p>
        <div className="flex flex-col gap-2">
          {scanTypes.map((type) => (
            <motion.button key={type.id} whileTap={{ scale: 0.99 }} onClick={() => setScanType(type.id)} className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left" style={{ background: scanType === type.id ? `${type.color}0d` : "rgba(10,20,40,0.6)", border: scanType === type.id ? `1px solid ${type.color}40` : "1px solid rgba(28,50,84,0.6)", transition: "all 0.2s" }}>
              <div className="flex items-center justify-center rounded-xl" style={{ width: "38px", height: "38px", background: scanType === type.id ? `${type.color}18` : "rgba(28,50,84,0.4)" }}>
                <type.icon size={18} style={{ color: scanType === type.id ? type.color : "#4a6080" }} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: "13px", fontWeight: 600, color: scanType === type.id ? type.color : "#8899b8", fontFamily: "Inter" }}>{type.label}</p>
                <p style={{ fontSize: "11px", color: "#3a5070", fontFamily: "Inter" }}>{type.desc}</p>
              </div>
              <div className="rounded-full" style={{ width: "18px", height: "18px", border: scanType === type.id ? `5px solid ${type.color}` : "2px solid rgba(28,50,84,0.8)", background: "transparent", transition: "all 0.2s" }} />
            </motion.button>
          ))}
        </div>
      </div>

      {scanType === "custom" && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="px-5 mb-5">
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Port Range</p>
          <input value={portRange} onChange={(e) => setPortRange(e.target.value)} placeholder="e.g. 1-1000 or 80,443,8080" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)", borderRadius: "14px", color: "#c8d8f0", fontSize: "13px", fontFamily: "JetBrains Mono, monospace", padding: "12px 16px", width: "100%", outline: "none" }} />
        </motion.div>
      )}

      <div className="px-5 mb-5">
        <button
          onClick={handleScan}
          disabled={!target.trim() || cannotScan}
          className="w-full py-3.5 rounded-2xl"
          style={{
            background: target.trim() && !cannotScan ? "linear-gradient(135deg,#0e6bb0,#0a4f8a)" : "rgba(28,50,84,0.6)",
            border: target.trim() && !cannotScan ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(28,50,84,0.6)",
            color: target.trim() && !cannotScan ? "#e8f4ff" : "#4a6080",
            fontSize: "14px",
            fontWeight: 700,
            fontFamily: "Inter"
          }}
        >
          {cannotScan ? "Local Agent Required" : "Start Workflow"}
        </button>
      </div>

      <div className="px-5">
        <div className="flex items-center justify-between mb-2">
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px" }}>Recent Targets</p>
          {loadingRecent && <RefreshCw size={12} style={{ color: "#4a6080", animation: "spin 1s linear infinite" }} />}
        </div>
        <div className="flex flex-col gap-2">
          {recentTargets.length === 0 && !loadingRecent ? (
            <div className="rounded-2xl px-4 py-4" style={{ background: "rgba(10,20,40,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>No previous targets yet.</p>
            </div>
          ) : recentTargets.map((item) => (
            <button key={`${item.target}-${item.time}`} onClick={() => setTarget(item.target)} className="rounded-2xl px-4 py-3 text-left" style={{ background: "rgba(10,20,40,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p style={{ fontSize: "12px", color: "#c8d8f0", fontFamily: "JetBrains Mono, monospace" }}>{item.target}</p>
                  <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", marginTop: "4px" }}>{item.scanType} · {item.time}</p>
                </div>
                <span style={{ fontSize: "10px", color: item.status === "completed" ? "#22c55e" : item.status === "failed" ? "#ef4444" : "#38bdf8", fontFamily: "Inter", textTransform: "capitalize" }}>{item.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
