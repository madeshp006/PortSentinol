import { useState } from "react";
import { motion } from "motion/react";
import { Network, Shield, AlertTriangle, ArrowRight, Play, Info, Server, Cpu, CheckCircle2 } from "lucide-react";

interface Node {
  id: string;
  label: string;
  ip: string;
  os: string;
  riskScore: number;
  severity: string;
  services: string[];
  findingsCount: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  protocol: string;
  port: number;
  weight: number;
  pivotVulnerability: string;
  description: string;
}

interface AttackGraphViewProps {
  graph: {
    isSubnetScan?: boolean;
    nodes?: Node[];
    edges?: Edge[];
    target?: string;
  };
  onSimulatePath?: (startHostId: string, vuln: string) => void;
  simulationResult?: any;
}

const severityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
};

export function AttackGraphView({ graph, onSimulatePath, simulationResult }: AttackGraphViewProps) {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const isSubnet = graph?.isSubnetScan ?? nodes.length > 1;

  const [selectedNode, setSelectedNode] = useState<Node | null>(nodes[0] || null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [entryHostId, setEntryHostId] = useState<string>(nodes[0]?.ip || "");
  const [entryVuln, setEntryVuln] = useState<string>("Weak SSH Credentials");

  if (!isSubnet || nodes.length <= 1) {
    return (
      <div className="mx-5 mb-4 p-5 rounded-2xl border" style={{ background: "rgba(10,20,40,0.6)", borderColor: "rgba(28,50,84,0.6)" }}>
        <div className="flex items-center gap-3">
          <Network size={20} style={{ color: "#38bdf8" }} />
          <div>
            <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
              Single-Host Target Assessment
            </h4>
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginTop: "2px" }}>
              Attack path reachability modeling is enabled when scanning multi-host subnets (CIDR / IP ranges). Single target scans display findings directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activePathHops: any[] = simulationResult?.pathHops || [];
  const activeReachableIps: string[] = simulationResult?.reachableHosts || [];

  const handleRunSimulation = () => {
    if (onSimulatePath && entryHostId) {
      onSimulatePath(entryHostId, entryVuln);
    }
  };

  return (
    <div className="mx-5 mb-5 p-5 rounded-2xl flex flex-col gap-4" style={{ background: "linear-gradient(135deg, #0d1f3c, #070d1e)", border: "1px solid rgba(28,50,84,0.8)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl" style={{ background: "rgba(56,189,248,0.12)" }}>
            <Network size={20} style={{ color: "#38bdf8" }} />
          </div>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
              Subnet Attack Path Graph & Lateral Pivoting Model
            </h3>
            <p style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "JetBrains Mono, monospace" }}>
              Target: {graph.target || "Subnet Range"} · {nodes.length} Nodes · {edges.length} Directed Vectors
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-lg border font-mono font-bold text-sky-400 border-sky-500/30" style={{ fontSize: "11px", background: "rgba(56,189,248,0.1)" }}>
          Interactive Topology
        </span>
      </div>

      {/* Interactive Subnet Graph Canvas Simulation */}
      <div className="relative p-6 rounded-2xl overflow-hidden flex flex-col gap-6" style={{ background: "rgba(4,8,20,0.9)", border: "1px solid rgba(28,50,84,0.7)" }}>
        {/* Nodes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-10">
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isReachable = activeReachableIps.includes(node.ip);
            const isEntry = simulationResult?.entryHost === node.ip;
            const nodeColor = severityColors[node.severity] || "#f59e0b";

            return (
              <motion.button
                key={node.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSelectedNode(node);
                  setSelectedEdge(null);
                }}
                className="p-4 rounded-2xl flex flex-col gap-2 text-left relative transition-all"
                style={{
                  background: isSelected ? "rgba(15,30,60,0.95)" : "rgba(10,20,40,0.8)",
                  border: isEntry
                    ? "2px solid #ef4444"
                    : isReachable
                    ? "2px solid #f97316"
                    : isSelected
                    ? "2px solid #38bdf8"
                    : "1px solid rgba(28,50,84,0.8)",
                  boxShadow: isEntry
                    ? "0 0 16px rgba(239,68,68,0.4)"
                    : isReachable
                    ? "0 0 12px rgba(249,115,22,0.3)"
                    : isSelected
                    ? "0 0 12px rgba(56,189,248,0.3)"
                    : "none",
                }}
              >
                {/* Node Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-200">{node.ip}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-semibold uppercase" style={{ background: `${nodeColor}20`, color: nodeColor }}>
                    {node.severity}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Server size={13} style={{ color: "#4a6080" }} />
                  <span style={{ fontSize: "11px", color: "#8899b8", fontFamily: "Inter" }} className="truncate">
                    {node.os}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                  <span>Score: <strong style={{ color: nodeColor }}>{node.riskScore}</strong></span>
                  <span>Services: {node.services.length}</span>
                </div>

                {/* Simulation indicator */}
                {isEntry && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white shadow">
                    ENTRY
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Directed Reachability Edges List */}
        <div>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>
            Discovered Pivot & Lateral Movement Edges ({edges.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {edges.map((edge) => {
              const isSelectedEdge = selectedEdge?.id === edge.id;
              const isPathHop = activePathHops.some((h) => h.fromHost === edge.source && h.toHost === edge.target);

              return (
                <button
                  key={edge.id}
                  onClick={() => {
                    setSelectedEdge(edge);
                    setSelectedNode(null);
                  }}
                  className="p-3 rounded-xl flex items-center justify-between text-left transition-all"
                  style={{
                    background: isSelectedEdge ? "rgba(56,189,248,0.12)" : isPathHop ? "rgba(239,68,68,0.12)" : "rgba(10,20,40,0.6)",
                    border: isPathHop ? "1px solid rgba(239,68,68,0.5)" : isSelectedEdge ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(28,50,84,0.6)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">{edge.source}</span>
                    <ArrowRight size={14} style={{ color: isPathHop ? "#ef4444" : "#4a6080" }} />
                    <span className="font-mono text-xs font-bold text-purple-400">{edge.target}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold" style={{ background: "rgba(7,13,30,0.8)", color: edge.weight > 0.8 ? "#ef4444" : "#f59e0b" }}>
                    Weight: {edge.weight}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Node or Edge Detail Drawer */}
      {selectedNode && (
        <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ background: "rgba(10,20,40,0.8)", border: "1px solid rgba(56,189,248,0.3)" }}>
          <div className="flex items-center justify-between">
            <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
              Selected Node Inspection: {selectedNode.label}
            </h4>
            <span style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "JetBrains Mono, monospace" }}>
              IP: {selectedNode.ip}
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "Inter" }}>
            Operating System / Core Banner: {selectedNode.os} · Risk Score: {selectedNode.riskScore}/100 ({selectedNode.severity.toUpperCase()})
          </p>
          <div className="flex gap-2 mt-1">
            {selectedNode.services.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded font-mono text-xs" style={{ background: "rgba(28,50,84,0.8)", color: "#38bdf8" }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {selectedEdge && (
        <div className="p-4 rounded-2xl flex flex-col gap-2" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.3)" }}>
          <div className="flex items-center justify-between">
            <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
              Selected Pivot Vector: {selectedEdge.source} ➔ {selectedEdge.target}
            </h4>
            <span style={{ fontSize: "11px", color: "#c084fc", fontFamily: "JetBrains Mono, monospace" }}>
              Weight {selectedEdge.weight}
            </span>
          </div>
          <p style={{ fontSize: "11px", color: "#cbd5e1", fontFamily: "Inter", fontWeight: 600 }}>
            Pivot Vulnerability: {selectedEdge.pivotVulnerability}
          </p>
          <p style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "Inter" }}>
            {selectedEdge.description}
          </p>
        </div>
      )}

      {/* STAGE 2: Interactive Attack Path Simulation Controls */}
      <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.25)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: "#ef4444" }} />
          <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#ef4444", fontFamily: "Inter" }}>
            Attack Path Traversal & Pivot Simulation
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>Select Initial Compromised Host</label>
            <select
              value={entryHostId}
              onChange={(e) => setEntryHostId(e.target.value)}
              style={{ width: "100%", background: "rgba(7,13,30,0.9)", border: "1px solid rgba(28,50,84,0.8)", borderRadius: "10px", color: "#c8d8f0", padding: "8px 10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace" }}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.ip}>
                  {n.ip} ({n.os})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "10px", color: "#4a6080", fontFamily: "Inter" }}>Initial Compromise Vulnerability</label>
            <input
              value={entryVuln}
              onChange={(e) => setEntryVuln(e.target.value)}
              placeholder="e.g. Weak SSH Credentials"
              style={{ width: "100%", background: "rgba(7,13,30,0.9)", border: "1px solid rgba(28,50,84,0.8)", borderRadius: "10px", color: "#c8d8f0", padding: "8px 10px", fontSize: "12px", fontFamily: "Inter" }}
            />
          </div>
        </div>

        <button
          onClick={handleRunSimulation}
          className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", fontSize: "12px", fontFamily: "Inter" }}
        >
          <Play size={14} /> Run Attack Path Simulation
        </button>

        {/* Simulation Output Card */}
        {simulationResult && simulationResult.success && (
          <div className="p-3.5 rounded-xl flex flex-col gap-2 mt-2" style={{ background: "rgba(10,20,40,0.9)", border: "1px solid rgba(239,68,68,0.4)" }}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-red-400">
                Simulation Result: Path Risk Score {simulationResult.pathRiskScore}/100 ({simulationResult.pathSeverity})
              </span>
              <span className="text-xs text-slate-400">{simulationResult.totalHops} Lateral Hops</span>
            </div>
            <p style={{ fontSize: "11px", color: "#cbd5e1", fontFamily: "Inter", lineHeight: 1.4 }}>
              {simulationResult.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
