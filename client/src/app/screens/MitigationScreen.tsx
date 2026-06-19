import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import {
  ChevronLeft, Share2, Shield, Terminal, Copy,
  CheckCircle2, Circle, RefreshCw,
} from "lucide-react";
import { type RiskLevel } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { safeCopy } from "../utils/clipboard";
import { getRememberedScanId, hydrateScan, rememberCurrentScan } from "../utils/scanData";

const riskColor: Record<RiskLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
  info: "#3b82f6",
};

const priorityOrder = ["critical", "high", "medium", "low"];

export function MitigationScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [scan, setScan] = useState<any>(hydrateScan((location.state as any)?.scan));
  const [loading, setLoading] = useState(!(location.state as any)?.scan);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

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

  const misconfigs = useMemo(() => scan?.misconfigs ?? [], [scan]);
  const sortedMisconfigs = [...misconfigs].sort((a: any, b: any) => priorityOrder.indexOf(a.risk) - priorityOrder.indexOf(b.risk));

  const toggleResolved = (id: string) => {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const completedCount = resolved.size;
  const progress = sortedMisconfigs.length ? (completedCount / sortedMisconfigs.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "780px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={26} style={{ color: "#38bdf8" }} />
        </motion.div>
        <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>Loading mitigation guide...</p>
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
        <div className="flex-1">
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Mitigation Guide</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{completedCount}/{sortedMisconfigs.length} resolved</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", fontSize: "12px", fontFamily: "Inter" }}>
          <Share2 size={13} /> Share
        </button>
      </div>

      <div className="mx-5 mb-4 rounded-2xl p-4" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield size={16} style={{ color: "#38bdf8" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>Remediation Progress</span>
          </div>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#22c55e", fontFamily: "Inter" }}>{Math.round(progress)}%</span>
        </div>
        <div className="rounded-full overflow-hidden mb-3" style={{ height: "8px", background: "rgba(28,50,84,0.6)" }}>
          <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #22c55e, #16a34a)" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {priorityOrder.map((risk) => {
            const total = sortedMisconfigs.filter((m: any) => m.risk === risk).length;
            const done = sortedMisconfigs.filter((m: any) => m.risk === risk && resolved.has(m.id)).length;
            const color = riskColor[risk as RiskLevel];
            return (
              <div key={risk} className="text-center">
                <p style={{ fontSize: "14px", fontWeight: 700, color: done === total && total > 0 ? "#22c55e" : color, fontFamily: "Inter" }}>{done}/{total}</p>
                <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter", textTransform: "capitalize" }}>{risk}</p>
              </div>
            );
          })}
        </div>
      </div>

      {sortedMisconfigs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 mt-12">
          <CheckCircle2 size={32} style={{ color: "#22c55e" }} />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>No remediation steps needed</p>
          <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter", textAlign: "center" }}>This scan did not save actionable findings.</p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-3">
          {sortedMisconfigs.map((m: any, i: number) => {
            const color = riskColor[m.risk as RiskLevel];
            const isResolved = resolved.has(m.id);
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl overflow-hidden" style={{ border: isResolved ? "1px solid rgba(34,197,94,0.25)" : `1px solid rgba(28,50,84,0.7)`, background: isResolved ? "rgba(34,197,94,0.04)" : "rgba(10,20,40,0.7)", opacity: isResolved ? 0.75 : 1, transition: "all 0.3s" }}>
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <button onClick={() => toggleResolved(m.id)} className="mt-0.5 shrink-0" style={{ color: isResolved ? "#22c55e" : "#2a3f5e" }}>
                    {isResolved ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontSize: "13px", fontWeight: 600, color: isResolved ? "#4a6080" : "#c8d8f0", fontFamily: "Inter", textDecoration: isResolved ? "line-through" : "none" }}>{m.title}</p>
                      <span className="px-2 py-0.5 rounded-lg border capitalize" style={{ background: `${color}12`, color, borderColor: `${color}25`, fontSize: "10px", fontWeight: 600, fontFamily: "Inter" }}>{m.risk}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {m.port ? <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: "10px" }}>:{m.port}</span> : null}
                      <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{m.service}</span>
                      <span style={{ fontSize: "11px", color: "#3a5070", fontFamily: "Inter" }}>· {m.affected}</span>
                    </div>
                  </div>
                </div>

                {!isResolved && (
                  <div className="px-4 pb-4">
                    <p style={{ fontSize: "12px", color: "#6a8aaa", fontFamily: "Inter", lineHeight: 1.6, marginBottom: "12px" }}>{m.description}</p>
                    <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(4,8,20,0.8)", border: "1px solid rgba(28,50,84,0.6)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Terminal size={12} style={{ color: "#38bdf8" }} />
                          <span style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "Inter" }}>Recommended Action</span>
                        </div>
                        <button onClick={() => safeCopy(m.fix)} style={{ color: "#3a5070" }}>
                          <Copy size={12} />
                        </button>
                      </div>
                      <p style={{ fontSize: "11px", color: "#22c55e", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{m.fix}</p>
                    </div>
                    <button onClick={() => toggleResolved(m.id)} className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", fontSize: "12px", fontWeight: 600, fontFamily: "Inter" }}>
                      <CheckCircle2 size={14} /> Mark as Resolved
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {sortedMisconfigs.length > 0 && completedCount === sortedMisconfigs.length && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-5 mt-5 rounded-2xl p-4 text-center" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <CheckCircle2 size={28} style={{ color: "#22c55e", margin: "0 auto 8px" }} />
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#22c55e", fontFamily: "Inter" }}>All Issues Resolved! 🎉</p>
          <p style={{ fontSize: "12px", color: "#4a8060", fontFamily: "Inter", marginTop: "4px" }}>Run a new scan to verify your fixes</p>
        </motion.div>
      )}
    </div>
  );
}
