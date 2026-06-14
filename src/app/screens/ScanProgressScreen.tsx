import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, Square, CheckCircle2, RefreshCw, Shield, AlertTriangle } from "lucide-react";
import * as api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { hydrateScan, rememberCurrentScan } from "../utils/scanData";

const logColors: Record<string, string> = {
  info: "#4a6080",
  success: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
  error: "#ef4444",
};

export function ScanProgressScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const socket = useSocket();

  const state = (location.state as any) || {};
  const [scan, setScan] = useState<any>(state.scan ? hydrateScan(state.scan) : null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [starting, setStarting] = useState(!state.scan);

  useEffect(() => {
    if (!token) return;
    if (scan?.id) return;
    if (!state.target) {
      setScanError("No target was provided for this workflow.");
      setStarting(false);
      return;
    }

    setStarting(true);
    api.startScan(token, {
      target: state.target,
      scanType: state.scanType || "quick",
      portRange: state.portRange || "",
      agentId: state.agentId || "",
    })
      .then((resp) => {
        const hydrated = hydrateScan(resp.scan);
        setScan(hydrated);
        rememberCurrentScan(hydrated);
      })
      .catch((e: any) => setScanError(e.message || "Failed to start workflow"))
      .finally(() => setStarting(false));
  }, [token, state.target, state.scanType, state.portRange, scan?.id]);

  useEffect(() => {
    if (!token || !scan?.id) return;
    if (["completed", "failed", "cancelled"].includes(scan.status)) return;

    const timer = window.setInterval(() => {
      api.getScan(token, scan.id)
        .then((fresh) => {
          const hydrated = hydrateScan(fresh);
          setScan(hydrated);
          rememberCurrentScan(hydrated);
        })
        .catch((e) => setScanError(e.message || "Failed to refresh scan status"));
    }, 2000);

    return () => window.clearInterval(timer);
  }, [token, scan?.id, scan?.status]);

  useEffect(() => {
    if (!socket || !scan?.id) return;
    if (["completed", "failed", "cancelled"].includes(scan.status)) return;

    const handleProgress = (data: any) => {
      if (data.scanId === scan.id) {
        setScan((prev: any) => {
          if (!prev) return null;
          return hydrateScan({
            ...prev,
            progress: data.progress,
            currentStage: data.currentStage,
            timeline: data.timeline || prev.timeline,
          });
        });
      }
    };

    const handleCompleted = (data: any) => {
      if (data.scanId === scan.id) {
        setScan(hydrateScan(data.scan));
      }
    };

    const handleFailed = (data: any) => {
      if (data.scanId === scan.id) {
        setScan((prev: any) => {
          if (!prev) return null;
          return hydrateScan({
            ...prev,
            status: "failed",
            progress: 100,
            currentStage: "failed",
            errorMessage: data.error,
          });
        });
      }
    };

    socket.on("scan:progress", handleProgress);
    socket.on("scan:completed", handleCompleted);
    socket.on("scan:failed", handleFailed);

    return () => {
      socket.off("scan:progress", handleProgress);
      socket.off("scan:completed", handleCompleted);
      socket.off("scan:failed", handleFailed);
    };
  }, [socket, scan?.id, scan?.status]);

  const done = Boolean(scan && ["completed", "failed", "cancelled"].includes(scan.status));
  const timeline = useMemo(() => Array.isArray(scan?.timeline) ? scan.timeline : [], [scan]);
  const portsFound = scan?.openPorts ?? 0;
  const services = scan?.servicesDetected ?? 0;
  const progress = scan?.progress ?? 0;
  const statusLabel = scan?.status ? String(scan.status).charAt(0).toUpperCase() + String(scan.status).slice(1) : "Preparing";

  const handleStop = async () => {
    if (!token || !scan?.id) {
      navigate("/app/scan");
      return;
    }
    try {
      if (["queued", "running"].includes(scan.status)) {
        await api.cancelScan(token, scan.id);
      }
    } catch (e: any) {
      setScanError(e.message || "Failed to cancel workflow");
    }
  };

  const handleViewResults = () => {
    if (scan) {
      navigate("/app/scan/results", { state: { scan } });
    } else {
      navigate("/app/scan/results");
    }
  };

  return (
    <div className="flex flex-col pb-4" style={{ minHeight: "780px" }}>
      <div className="px-5 pt-4 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/app/scan")} className="flex items-center justify-center rounded-xl" style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div className="flex-1">
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
            {done ? (scan?.status === "completed" ? "Scan Complete" : statusLabel) : "Workflow Running"}
          </h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
            {scan?.target || state.target || "Awaiting target"} · {scan?.scanType || state.scanType || "Quick Scan"}
          </p>
        </div>
        {!done && (
          <button onClick={handleStop} className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "12px", fontFamily: "Inter" }}>
            <Square size={12} fill="currentColor" /> Cancel
          </button>
        )}
      </div>

      <div className="mx-5 mb-4 rounded-2xl p-5" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
        <div className="flex justify-center mb-5">
          <div className="relative flex items-center justify-center" style={{ width: "100px", height: "100px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="absolute rounded-full border" style={{ width: `${i * 30}px`, height: `${i * 30}px`, borderColor: `rgba(56,189,248,${0.2 / i})` }} />
            ))}
            {done && scan?.status === "completed" ? (
              <CheckCircle2 size={36} style={{ color: "#22c55e" }} />
            ) : starting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                <RefreshCw size={34} style={{ color: "#38bdf8" }} />
              </motion.div>
            ) : (
              <Shield size={34} style={{ color: "#38bdf8" }} />
            )}
          </div>
        </div>

        <div className="text-center mb-4">
          <p style={{ fontSize: "28px", fontWeight: 800, color: done && scan?.status === "completed" ? "#22c55e" : "#38bdf8", fontFamily: "Inter" }}>{progress}%</p>
          <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter" }}>{scan?.currentStage || (starting ? "queueing" : "waiting")}</p>
        </div>

        <div className="rounded-full overflow-hidden mb-4" style={{ height: "8px", background: "rgba(28,50,84,0.6)" }}>
          <motion.div className="h-full rounded-full" style={{ background: scan?.status === "failed" ? "#ef4444" : "linear-gradient(90deg, #38bdf8, #06b6d4)" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Status", value: statusLabel, color: scan?.status === "failed" ? "#ef4444" : scan?.status === "completed" ? "#22c55e" : "#38bdf8" },
            { label: "Open Ports", value: String(portsFound), color: "#f59e0b" },
            { label: "Services", value: String(services), color: "#a78bfa" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl py-3 text-center" style={{ background: "rgba(7,13,30,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: item.color, fontFamily: "Inter" }}>{item.value}</p>
              <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter" }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {scanError && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-2xl flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertTriangle size={14} style={{ color: "#ef4444" }} />
          <span style={{ fontSize: "12px", color: "#ef4444", fontFamily: "Inter" }}>{scanError}</span>
        </div>
      )}

      <div className="mx-5 flex-1 rounded-2xl p-4" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.7)" }}>
        <p style={{ fontSize: "12px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter", marginBottom: "10px" }}>Workflow Log</p>
        <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
          {timeline.length === 0 ? (
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{starting ? "Creating job..." : "No log entries yet."}</p>
          ) : timeline.map((line: any, index: number) => (
            <div key={`${line.at || index}-${index}`} className="rounded-xl px-3 py-2" style={{ background: "rgba(7,13,30,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
              <p style={{ fontSize: "11px", color: logColors[line.level || "info"] || "#4a6080", fontFamily: "Inter" }}>{line.msg}</p>
            </div>
          ))}
        </div>
      </div>

      {done && (
        <div className="px-5 pt-4">
          {scan?.status === "completed" ? (
            <button onClick={handleViewResults} className="w-full py-3.5 rounded-2xl" style={{ background: "linear-gradient(135deg,#0e6bb0,#0a4f8a)", border: "1px solid rgba(56,189,248,0.3)", color: "#e8f4ff", fontSize: "14px", fontWeight: 700, fontFamily: "Inter" }}>
              View Results
            </button>
          ) : (
            <button onClick={() => navigate("/app/history")} className="w-full py-3.5 rounded-2xl" style={{ background: "rgba(28,50,84,0.6)", border: "1px solid rgba(28,50,84,0.6)", color: "#c8d8f0", fontSize: "14px", fontWeight: 700, fontFamily: "Inter" }}>
              Open History
            </button>
          )}
        </div>
      )}
    </div>
  );
}
