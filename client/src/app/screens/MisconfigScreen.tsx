import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, ChevronDown, ChevronUp, Shield, AlertTriangle, RefreshCw } from "lucide-react";
import { type RiskLevel } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { getRememberedScanId, hydrateScan, rememberCurrentScan } from "../utils/scanData";

const riskColor: Record<RiskLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
  info: "#3b82f6",
};

const priorityOrder = ["critical", "high", "medium", "low"];

export function MisconfigScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [scan, setScan] = useState<any>(hydrateScan((location.state as any)?.scan));
  const [loading, setLoading] = useState(!(location.state as any)?.scan);
  const [expanded, setExpanded] = useState<string | null>(null);

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
  const grouped = priorityOrder.map((risk) => ({
    risk,
    items: misconfigs.filter((m: any) => m.risk === risk),
  })).filter((group) => group.items.length > 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "780px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={26} style={{ color: "#38bdf8" }} />
        </motion.div>
        <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>Loading findings...</p>
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
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Misconfigurations</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
            {misconfigs.length} issue{misconfigs.length !== 1 ? "s" : ""} · {scan?.target || "Current target"}
          </p>
        </div>
      </div>

      {misconfigs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-5 mt-12">
          <Shield size={32} style={{ color: "#22c55e" }} />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>No misconfigurations recorded</p>
          <p style={{ fontSize: "12px", color: "#4a6080", fontFamily: "Inter", textAlign: "center" }}>
            This scan did not save any remediation findings.
          </p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-4">
          {grouped.map(({ risk, items }) => {
            const color = riskColor[risk as RiskLevel];
            return (
              <div key={risk}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-full" style={{ width: 8, height: 8, background: color }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color, fontFamily: "Inter", textTransform: "capitalize" }}>{risk}</span>
                  <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>({items.length})</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((misconfig: any) => (
                    <div key={misconfig.id}>
                      <button
                        onClick={() => setExpanded(expanded === misconfig.id ? null : misconfig.id)}
                        className="w-full px-4 py-3 rounded-2xl text-left"
                        style={{
                          background: expanded === misconfig.id ? `${color}08` : "rgba(10,20,40,0.7)",
                          border: expanded === misconfig.id ? `1px solid ${color}30` : "1px solid rgba(28,50,84,0.7)",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-full" style={{ width: 8, height: 8, background: color, flexShrink: 0 }} />
                          <div className="flex-1">
                            <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>{misconfig.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {misconfig.port ? (
                                <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: "10px" }}>
                                  :{misconfig.port}
                                </span>
                              ) : null}
                              <span style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{misconfig.service}</span>
                              <span style={{ fontSize: "11px", color: "#3a5070", fontFamily: "Inter" }}>· {misconfig.affected}</span>
                            </div>
                          </div>
                          {expanded === misconfig.id ? <ChevronUp size={16} style={{ color: color }} /> : <ChevronDown size={16} style={{ color: "#3a5070" }} />}
                        </div>
                      </button>

                      {expanded === misconfig.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="px-4 pt-3 pb-4 rounded-b-2xl"
                          style={{ background: "rgba(4,8,20,0.65)", border: `1px solid ${color}18`, borderTop: "none" }}
                        >
                          <p style={{ fontSize: "12px", color: "#8899b8", fontFamily: "Inter", lineHeight: 1.6 }}>{misconfig.description}</p>
                          <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}>
                            <p style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>Recommended Fix</p>
                            <p style={{ fontSize: "12px", color: "#22c55e", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.6 }}>{misconfig.fix}</p>
                          </div>
                          <button
                            onClick={() => navigate("/app/scan/results/mitigation", { state: scan ? { scan } : undefined })}
                            className="mt-3 px-4 py-2 rounded-xl"
                            style={{ background: `${color}15`, border: `1px solid ${color}25`, color, fontSize: "12px", fontWeight: 600, fontFamily: "Inter" }}
                          >
                            Open Mitigation Guide
                          </button>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
