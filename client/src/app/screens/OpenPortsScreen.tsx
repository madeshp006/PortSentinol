import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, RefreshCw } from "lucide-react";
import { type RiskLevel } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";
import { getRememberedScanId, hydrateScan, rememberCurrentScan } from "../utils/scanData";

const filterTabs: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const riskDot: Record<RiskLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
  info: "#3b82f6",
};

export function OpenPortsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
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

  const ports = useMemo(() => scan?.ports ?? [], [scan]);

  const filtered = ports.filter((p: any) => {
    const matchFilter = filter === "all" || p.risk === filter;
    const matchSearch =
      search === "" ||
      String(p.number).includes(search) ||
      p.service.toLowerCase().includes(search.toLowerCase()) ||
      p.version.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: "780px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
          <RefreshCw size={26} style={{ color: "#38bdf8" }} />
        </motion.div>
        <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>Loading open ports...</p>
      </div>
    );
  }

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/app/scan/results", { state: scan ? { scan } : undefined })}
          className="flex items-center justify-center rounded-xl"
          style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div className="flex-1">
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Open Ports</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>{ports.length} ports found · {scan?.target || "Current target"}</p>
        </div>
        <button
          className="flex items-center justify-center rounded-xl"
          style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <SlidersHorizontal size={16} style={{ color: "#8899b8" }} />
        </button>
      </div>

      <div className="px-5 mb-3">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#4a6080" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search port, service, version..."
            style={{
              background: "rgba(10,20,40,0.8)",
              border: "1px solid rgba(28,50,84,0.7)",
              borderRadius: "14px",
              color: "#c8d8f0",
              fontSize: "13px",
              fontFamily: "Inter",
              padding: "11px 16px 11px 38px",
              width: "100%",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div className="flex gap-2 px-5 mb-4 overflow-x-auto scrollbar-hide pb-1">
        {filterTabs.map((tab) => {
          const isActive = filter === tab.value;
          const color = tab.value === "all" ? "#38bdf8"
            : tab.value === "critical" ? "#ef4444"
            : tab.value === "high" ? "#f97316"
            : tab.value === "medium" ? "#f59e0b"
            : "#22c55e";
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="px-4 py-1.5 rounded-xl whitespace-nowrap"
              style={{
                background: isActive ? `${color}15` : "rgba(10,20,40,0.6)",
                border: isActive ? `1px solid ${color}40` : "1px solid rgba(28,50,84,0.5)",
                color: isActive ? color : "#4a6080",
                fontSize: "12px",
                fontWeight: isActive ? 600 : 400,
                fontFamily: "Inter",
              }}
            >
              {tab.label}
              {tab.value !== "all" && <span style={{ marginLeft: "5px" }}>({ports.filter((p: any) => p.risk === tab.value).length})</span>}
            </button>
          );
        })}
      </div>

      <div className="px-5 flex flex-col gap-2.5">
        {filtered.map((port: any, i: number) => (
          <motion.button
            key={port.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/app/scan/results/ports/${port.id}`, { state: { scan } })}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left w-full"
            style={{ background: "rgba(10,20,40,0.7)", border: "1px solid rgba(28,50,84,0.6)" }}
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: "50px", height: "44px",
                background: `${riskDot[port.risk as RiskLevel]}12`,
                border: `1px solid ${riskDot[port.risk as RiskLevel]}25`,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: "16px", fontWeight: 700, color: riskDot[port.risk as RiskLevel], fontFamily: "JetBrains Mono, monospace" }}>
                {port.number}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>{port.service}</span>
                <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(28,50,84,0.6)", color: "#4a6080", fontSize: "9px", fontFamily: "JetBrains Mono, monospace" }}>
                  {port.protocol}
                </span>
              </div>
              <p style={{ fontSize: "11px", color: "#3a5070", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>{port.version}</p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="px-2 py-1 rounded-lg border capitalize"
                style={{
                  background: `${riskDot[port.risk as RiskLevel]}12`,
                  color: riskDot[port.risk as RiskLevel],
                  borderColor: `${riskDot[port.risk as RiskLevel]}30`,
                  fontSize: "10px",
                  fontWeight: 600,
                  fontFamily: "Inter",
                }}
              >
                {port.risk}
              </span>
              <ChevronRight size={14} style={{ color: "#3a5070" }} />
            </div>
          </motion.button>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12">
            <Search size={28} style={{ color: "#2a3f5e" }} />
            <p style={{ fontSize: "14px", color: "#4a6080", fontFamily: "Inter" }}>
              {ports.length === 0 ? "No open ports were recorded for this scan" : "No ports match the current filters"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
