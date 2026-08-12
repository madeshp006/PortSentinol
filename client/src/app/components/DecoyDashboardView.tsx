import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Shield, Radio, AlertTriangle, Play, RefreshCw, CheckCircle2, Lock, Terminal, Cpu } from "lucide-react";
import * as api from "../utils/api";

interface DecoyTrap {
  trapId: string;
  type: string;
  port: number;
  serviceName: string;
  startedAt: string;
  status: string;
}

interface ProbeLog {
  id: string;
  timestamp: string;
  sourceIp: string;
  sourcePort: number;
  targetPort: number;
  decoyType: string;
  serviceName: string;
  attemptedUser: string;
  attemptedPass: string;
  severity: string;
  status: string;
}

interface DecoyDashboardViewProps {
  token: string | null;
}

export function DecoyDashboardView({ token }: DecoyDashboardViewProps) {
  const [activeTraps, setActiveTraps] = useState<DecoyTrap[]>([]);
  const [probeLogs, setProbeLogs] = useState<ProbeLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [userConsent, setUserConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [selectedType, setSelectedType] = useState<"ssh" | "ftp" | "http">("ssh");
  const [selectedPort, setSelectedPort] = useState<number>(2222);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchStatus = () => {
    if (!token) return;
    setLoading(true);
    api.getDecoyStatus(token)
      .then((data: any) => {
        setStatusError(null);
        if (data && Array.isArray(data.activeTraps)) {
          setActiveTraps(data.activeTraps);
        }
        if (data && Array.isArray(data.probeLogs) && data.probeLogs.length > 0) {
          setProbeLogs(data.probeLogs);
        }
      })
      .catch((e: any) => {
        console.log("Fetch decoy status error:", e.message);
        setStatusError(e.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleStartTrap = () => {
    if (!userConsent) {
      setShowConsentModal(true);
      return;
    }

    const serviceName = selectedType === "ssh" ? "Fake SSH Trap (OpenSSH 7.2p2)" : selectedType === "ftp" ? "Fake FTP Trap (vsFTPd 2.3.4)" : "Fake HTTP Trap (Apache 2.4.7)";
    const fallbackTrap: DecoyTrap = {
      trapId: `trap-${selectedType}-${selectedPort}`,
      type: selectedType,
      port: selectedPort,
      serviceName,
      startedAt: new Date().toISOString(),
      status: "ACTIVE",
    };

    if (token) {
      setLoading(true);
      api.startDecoy(token, { type: selectedType, port: selectedPort, userConsent: true })
        .then((res: any) => {
          if (res && res.error) {
            alert(`Failed to start trap: ${res.error}`);
          } else {
            setActiveTraps((prev) => {
              if (prev.some((t) => t.trapId === fallbackTrap.trapId)) return prev;
              return [fallbackTrap, ...prev];
            });
            fetchStatus();
          }
        })
        .catch((e: any) => alert(`Trap Start Error: ${e.message}`))
        .finally(() => setLoading(false));
    } else {
      setActiveTraps((prev) => [fallbackTrap, ...prev]);
    }
  };

  const handleStopTrap = (trapId: string) => {
    setActiveTraps((prev) => prev.filter((t) => t.trapId !== trapId));
    if (token) {
      api.stopDecoy(token, trapId)
        .then(() => fetchStatus())
        .catch((e: any) => console.log("Stop trap error:", e.message));
    }
  };

  const handleSimulateProbe = () => {
    const serviceName = selectedType === "ssh" ? "Fake SSH Trap (OpenSSH 7.2p2)" : selectedType === "ftp" ? "Fake FTP Trap (vsFTPd 2.3.4)" : "Fake HTTP Trap (Apache 2.4.7)";
    const mockHit: ProbeLog = {
      id: `probe-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      sourceIp: "192.168.1.105",
      sourcePort: Math.floor(Math.random() * 10000) + 50000,
      targetPort: selectedPort,
      decoyType: selectedType,
      serviceName,
      attemptedUser: selectedType === "ssh" ? "root" : selectedType === "ftp" ? "anonymous" : "admin",
      attemptedPass: selectedType === "ssh" ? "toor" : selectedType === "ftp" ? "guest@local" : "admin123",
      severity: "HIGH",
      status: "DETECTED",
    };

    setProbeLogs((prev) => [mockHit, ...prev]);

    if (token) {
      api.simulateDecoyProbe(token, {
        type: selectedType,
        port: selectedPort,
        sourceIp: "192.168.1.105",
        attemptedUser: mockHit.attemptedUser,
        attemptedPass: mockHit.attemptedPass,
      }).catch((e: any) => console.log("Simulate probe API error:", e.message));
    }
  };

  return (
    <div className="mx-5 mb-5 p-5 rounded-2xl flex flex-col gap-4" style={{ background: "linear-gradient(135deg, #0d1f3c, #070d1e)", border: "1px solid rgba(28,50,84,0.8)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl" style={{ background: "rgba(239,68,68,0.12)" }}>
            <Radio size={20} style={{ color: "#ef4444" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
              Deception & Honeypot Trap Engine
            </h3>
            <p style={{ fontSize: "11px", color: "#8899b8", fontFamily: "Inter" }}>
              Deploy fake listening services to catch & log unauthorized network probes
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          className="p-2 rounded-xl"
          style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)", color: "#38bdf8" }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {statusError && (
        <div className="p-3 rounded-xl flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertTriangle size={14} />
          <span>Backend Connection Note: {statusError}</span>
        </div>
      )}

      {/* Trap Deployment Controls */}
      <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.7)" }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#c8d8f0", fontFamily: "Inter" }}>
            Deploy Live Decoy Service Listener
          </span>
          <span style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>
            Default OFF · Opt-in per Target
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>Decoy Service Type</label>
            <select
              value={selectedType}
              onChange={(e) => {
                const t = e.target.value as "ssh" | "ftp" | "http";
                setSelectedType(t);
                setSelectedPort(t === "ssh" ? 2222 : t === "ftp" ? 2121 : 8080);
              }}
              style={{ width: "100%", background: "rgba(7,13,30,0.9)", border: "1px solid rgba(28,50,84,0.8)", borderRadius: "10px", color: "#c8d8f0", padding: "8px 10px", fontSize: "12px", fontFamily: "Inter" }}
            >
              <option value="ssh">Fake SSH (Port 2222)</option>
              <option value="ftp">Fake FTP (Port 2121)</option>
              <option value="http">Fake HTTP (Port 8080)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>Listening Port</label>
            <input
              type="number"
              value={selectedPort}
              onChange={(e) => setSelectedPort(Number(e.target.value))}
              style={{ width: "100%", background: "rgba(7,13,30,0.9)", border: "1px solid rgba(28,50,84,0.8)", borderRadius: "10px", color: "#c8d8f0", padding: "8px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace" }}
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                if (!userConsent) setShowConsentModal(true);
                else handleStartTrap();
              }}
              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs text-white"
              style={{ background: "linear-gradient(135deg, #0e6bb0, #0a4f8a)", fontFamily: "Inter" }}
            >
              <Radio size={14} /> Start Trap
            </button>
            <button
              onClick={handleSimulateProbe}
              className="px-3 py-2.5 rounded-xl flex items-center justify-center gap-1 font-semibold text-xs text-amber-400 border border-amber-500/30"
              style={{ background: "rgba(245,158,11,0.1)", fontFamily: "Inter" }}
              title="Simulate Probe for Viva Demo"
            >
              <Play size={13} /> Demo Probe
            </button>
          </div>
        </div>
      </div>

      {/* Active Traps Grid */}
      <div>
        <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>
          Active Listening Traps ({activeTraps.length})
        </p>

        {activeTraps.length === 0 ? (
          <div className="p-4 rounded-xl text-center" style={{ background: "rgba(10,20,40,0.5)", border: "1px solid rgba(28,50,84,0.6)" }}>
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
              No active decoy traps listening. Select service above to spin up a trap.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {activeTraps.map((trap) => (
              <div key={trap.trapId} className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
                      {trap.serviceName}
                    </span>
                    <span style={{ fontSize: "10px", color: "#38bdf8", display: "block", fontFamily: "JetBrains Mono" }}>
                      Port {trap.port} · Listening on 0.0.0.0
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleStopTrap(trap.trapId)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30"
                  style={{ background: "rgba(239,68,68,0.1)", fontFamily: "Inter" }}
                >
                  Stop
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Probe Log Feed */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Real-Time Probe & Bruteforce Log Feed ({probeLogs.length})
          </p>
          {probeLogs.length > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/30">
              🚨 {probeLogs.length} PROBES TRAPPED
            </span>
          )}
        </div>

        {probeLogs.length === 0 ? (
          <div className="p-5 rounded-2xl text-center flex flex-col items-center gap-2" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <CheckCircle2 size={24} style={{ color: "#22c55e" }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#86efac", fontFamily: "Inter" }}>
              No Probing Detected — Network Segment Clear
            </span>
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
              Decoy traps present realistic banners to attract attackers. Any connection attempt will be logged instantly.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {probeLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl flex items-start gap-3"
                style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-red-500/20 text-red-400 mt-0.5">
                  {log.severity}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
                      Probe from {log.sourceIp}:{log.sourcePort} ➔ Port {log.targetPort} ({log.serviceName})
                    </span>
                    <span style={{ fontSize: "10px", color: "#4a6080", fontFamily: "JetBrains Mono" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 font-mono text-xs text-slate-300">
                    <span>User: <strong className="text-amber-400">{log.attemptedUser}</strong></span>
                    <span>Pass: <strong className="text-red-400">{log.attemptedPass}</strong></span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Consent Warning Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full p-6 rounded-2xl flex flex-col gap-4" style={{ background: "#0d1f3c", border: "1px solid rgba(239,68,68,0.5)" }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} style={{ color: "#ef4444" }} />
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
                Authorization Consent Warning
              </h3>
            </div>
            <p style={{ fontSize: "12px", color: "#cbd5e1", fontFamily: "Inter", lineHeight: 1.5 }}>
              Deploying live decoy services opens listening TCP ports (e.g. 2222, 2121) on this host. <strong>Confirm that you have explicit authorization to listen on these ports on your network.</strong> Decoys log connection payloads and reject access attempt safely.
            </p>

            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl" style={{ background: "rgba(7,13,30,0.6)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <input
                type="checkbox"
                checked={userConsent}
                onChange={(e) => setUserConsent(e.target.checked)}
                className="w-4 h-4 accent-red-500 rounded"
              />
              <span style={{ fontSize: "11px", color: "#e8f0fe", fontFamily: "Inter" }}>
                I confirm I am authorized to deploy live decoy listeners on this system.
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConsentModal(false)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-slate-400 border border-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={!userConsent}
                onClick={() => {
                  setShowConsentModal(false);
                  handleStartTrap();
                }}
                className="flex-1 py-2.5 rounded-xl font-semibold text-xs text-white bg-red-600 disabled:opacity-50"
              >
                Deploy Live Trap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
