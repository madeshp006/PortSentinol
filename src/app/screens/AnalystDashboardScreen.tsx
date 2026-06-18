import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, RefreshCw, Radar, ShieldAlert, Cpu, AlertTriangle, FileText, CheckCircle, Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

export function AnalystDashboardScreen() {
  const navigate = useNavigate();
  const { token, profile } = useAuth();
  const [scans, setScans] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");

  const loadDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [allScans, allAgents] = await Promise.all([
        api.getScans(token),
        api.getAgents(token),
      ]);
      setScans(allScans);
      setAgents(allAgents);
    } catch (e: any) {
      setError(e.message || "Failed to load analyst control metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && profile.role !== "SUPER_ADMIN" && profile.role !== "SECURITY_ANALYST") {
      navigate("/app");
      return;
    }
    loadDashboardData();
  }, [token, profile]);

  // Calculations
  const completedScans = scans.filter((s) => s.status === "completed");
  
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  completedScans.forEach((s) => {
    const ports = typeof s.ports === "string" ? JSON.parse(s.ports) : (Array.isArray(s.ports) ? s.ports : []);
    ports.forEach((p: any) => {
      const risk = String(p.risk).toLowerCase();
      if (risk === "critical") criticalCount++;
      else if (risk === "high") highCount++;
      else if (risk === "medium") mediumCount++;
      else if (risk === "low") lowCount++;
    });
  });

  const onlineAgents = agents.filter((a) => a.status === "online").length;

  const getRiskColor = (risk: string) => {
    const r = risk.toLowerCase();
    if (r === "critical") return "#ef4444";
    if (r === "high") return "#f97316";
    if (r === "medium") return "#eab308";
    return "#3b82f6";
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed") return "#10b981";
    if (s === "failed") return "#ef4444";
    if (s === "running") return "#38bdf8";
    return "#a78bfa";
  };

  // Scans filter
  const filteredScans = scans.filter((scan) => {
    const matchesSearch = scan.target.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || scan.status === statusFilter;
    
    // Check if scan has specific severity
    let matchesSeverity = true;
    if (severityFilter !== "ALL") {
      const ports = typeof scan.ports === "string" ? JSON.parse(scan.ports) : (Array.isArray(scan.ports) ? scan.ports : []);
      matchesSeverity = ports.some((p: any) => String(p.risk).toUpperCase() === severityFilter);
    }

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="pb-8 px-4 md:px-6" style={{ minHeight: "850px", fontFamily: "Inter" }}>
      {/* Header */}
      <div className="pt-4 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c3254]/40 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/app")} className="flex items-center justify-center rounded-xl bg-slate-900 border border-[#1c3254]/80 p-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#e8f0fe]">Threat Assessment Center</h2>
            <p className="text-xs text-[#4a6080]">Global logs, vulnerability counts, and agent telemetry</p>
          </div>
        </div>
        <div>
          <button onClick={loadDashboardData} className="flex items-center justify-center rounded-xl bg-slate-900 border border-[#1c3254]/80 p-2 text-sky-400 hover:text-sky-300">
            <motion.div animate={loading ? { rotate: 360 } : { rotate: 0 }} transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
              <RefreshCw size={16} />
            </motion.div>
          </button>
        </div>
      </div>

      {error && <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Global Scans", value: scans.length, icon: Radar, color: "#38bdf8" },
          { label: "Critical Findings", value: criticalCount, icon: ShieldAlert, color: "#ef4444" },
          { label: "High Threats", value: highCount, icon: AlertTriangle, color: "#f97316" },
          { label: "Active Agents", value: `${onlineAgents}/${agents.length}`, icon: Cpu, color: "#a78bfa" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl p-4 bg-slate-900/60 border border-[#1c3254]/40">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={18} style={{ color: stat.color }} />
              <span className="text-xl font-extrabold text-white">{stat.value}</span>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-wide text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Grid: Telemetry & Vulnerability distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Vulnerability Severity Distribution */}
        <div className="rounded-xl bg-slate-900/60 border border-[#1c3254]/40 p-4 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-200 text-sm mb-4">Vulnerability Distribution</h3>
            <div className="flex flex-col gap-3.5">
              {[
                { label: "Critical", count: criticalCount, color: "#ef4444" },
                { label: "High", count: highCount, color: "#f97316" },
                { label: "Medium", count: mediumCount, color: "#eab308" },
                { label: "Low", count: lowCount, color: "#3b82f6" },
              ].map((sev) => {
                const totalVal = criticalCount + highCount + mediumCount + lowCount || 1;
                const percent = Math.round((sev.count / totalVal) * 100);
                
                return (
                  <div key={sev.label}>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-400">{sev.label}</span>
                      <span style={{ color: sev.color }}>{sev.count} ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: sev.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-[#1c3254]/30 text-center">
            <p className="text-xs text-[#4a6080]">Severity counts from completed scans</p>
          </div>
        </div>

        {/* Global Agent Health status */}
        <div className="rounded-xl bg-slate-900/60 border border-[#1c3254]/40 p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-200 text-sm">Active Scanner Telemetry</h3>
            <span className="text-xs text-sky-400 font-semibold cursor-pointer hover:underline" onClick={() => navigate("/app/agents")}>
              Manage Agents
            </span>
          </div>
          <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto scrollbar-hide">
            {agents.length === 0 ? (
              <p className="text-xs text-[#4a6080] italic text-center py-6">No agents registered on this system.</p>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-[#1c3254]/25">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${agent.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-200">{agent.name}</div>
                      <div className="text-[10px] text-slate-500">{agent.deviceName} • {agent.operatingSystem}</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-900 border border-[#1c3254]/40 text-slate-400 px-2 py-0.5 rounded-full">
                    v{agent.version}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global Activity Log */}
      <div className="rounded-xl bg-slate-900/60 border border-[#1c3254]/40 overflow-hidden">
        <div className="p-4 border-b border-[#1c3254]/40 bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-bold text-slate-200 text-sm">System-Wide Scans Log</h3>
          <div className="flex flex-wrap gap-2.5 items-center">
            <input
              type="text"
              placeholder="Search target..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl bg-[#030812] border border-[#1c3254]/60 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl bg-[#030812] border border-[#1c3254]/60 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl bg-[#030812] border border-[#1c3254]/60 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-[#1c3254]/30 max-h-[350px] overflow-y-auto scrollbar-hide">
          {loading ? (
            <p className="text-center py-10 text-xs text-slate-500">Loading scans data log...</p>
          ) : filteredScans.length === 0 ? (
            <p className="text-center py-10 text-xs text-slate-500">No scans matching criteria.</p>
          ) : (
            filteredScans.map((scan) => {
              const date = new Date(scan.requestedAt).toLocaleString();
              const statusCol = getStatusColor(scan.status);
              
              // Extract threat counts
              const scanPorts = typeof scan.ports === "string" ? JSON.parse(scan.ports) : (Array.isArray(scan.ports) ? scan.ports : []);
              let crit = 0, hi = 0, med = 0, lo = 0;
              scanPorts.forEach((p: any) => {
                const risk = String(p.risk).toLowerCase();
                if (risk === "critical") crit++;
                else if (risk === "high") hi++;
                else if (risk === "medium") med++;
                else if (risk === "low") lo++;
              });

              return (
                <div key={scan.id} className="p-4 hover:bg-slate-800/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold font-mono text-slate-200">{scan.target}</span>
                      <span className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 rounded-full bg-slate-900 border border-[#1c3254]/35">
                        {scan.scanType}
                      </span>
                      {scan.user && (
                        <span className="text-[10px] text-indigo-400 font-medium">
                          by {scan.user.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><Clock size={10} /> {date}</span>
                      <span>•</span>
                      <span>Worker: {scan.workerMode}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Severities inside this scan */}
                    {scan.status === "completed" && (
                      <div className="flex gap-1.5">
                        {crit > 0 && <span className="text-[9px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded">C:{crit}</span>}
                        {hi > 0 && <span className="text-[9px] font-bold text-white bg-orange-600 px-1.5 py-0.5 rounded">H:{hi}</span>}
                        {med > 0 && <span className="text-[9px] font-bold text-[#0f0e08] bg-yellow-400 px-1.5 py-0.5 rounded">M:{med}</span>}
                        {lo > 0 && <span className="text-[9px] font-bold text-white bg-blue-600 px-1.5 py-0.5 rounded">L:{lo}</span>}
                        {crit === 0 && hi === 0 && med === 0 && lo === 0 && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle size={8} /> Clean
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: statusCol }}>
                        {scan.status}
                      </span>
                      {scan.status === "completed" && (
                        <button
                          onClick={() => navigate(`/app/reports`, { state: { scan } })}
                          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-[10px] font-bold px-2.5 py-1.5 hover:bg-slate-700 hover:text-white"
                        >
                          <FileText size={10} /> Report
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
