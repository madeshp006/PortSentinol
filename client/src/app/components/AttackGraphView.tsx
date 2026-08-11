import { useState } from "react";
import { motion } from "motion/react";
import { Network, Shield, AlertTriangle, ArrowRight, Play, Info, Server, Cpu, CheckCircle2, Eye } from "lucide-react";

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

const DEFAULT_DEMO_NODES: Node[] = [
  { id: "192.168.1.10", label: "Host 192.168.1.10", ip: "192.168.1.10", os: "OpenSSH 7.2p2", riskScore: 58, severity: "high", services: ["ssh", "http"], findingsCount: 3 },
  { id: "192.168.1.20", label: "Host 192.168.1.20", ip: "192.168.1.20", os: "vsftpd 2.3.4 Backdoor", riskScore: 18, severity: "critical", services: ["ftp", "smb"], findingsCount: 2 },
  { id: "192.168.1.30", label: "Host 192.168.1.30", ip: "192.168.1.30", os: "Apache 2.4.7 / RDP", riskScore: 35, severity: "critical", services: ["http", "rdp"], findingsCount: 2 },
  { id: "192.168.1.40", label: "Host 192.168.1.40", ip: "192.168.1.40", os: "nginx 1.18", riskScore: 92, severity: "low", services: ["https"], findingsCount: 0 },
];

const DEFAULT_DEMO_EDGES: Edge[] = [
  { id: "edge-10-20-ftp", source: "192.168.1.10", target: "192.168.1.20", protocol: "ftp", port: 21, weight: 0.90, pivotVulnerability: "Unauthenticated FTP Backdoor Exploit (CVE-2011-2523)", description: "Attacker on 192.168.1.10 can exploit vsftpd backdoor on 192.168.1.20 to gain remote root shell." },
  { id: "edge-20-30-smb", source: "192.168.1.20", target: "192.168.1.30", protocol: "smb", port: 445, weight: 0.80, pivotVulnerability: "SMB/NetBIOS Share Lateral Movement", description: "Attacker can pivot from 192.168.1.20 to 192.168.1.30 via SMB share enumeration." },
  { id: "edge-30-40-subnet", source: "192.168.1.30", target: "192.168.1.40", protocol: "tcp", port: 0, weight: 0.20, pivotVulnerability: "Subnet Broadcast Domain Reachability", description: "Both hosts share the same subnet broadcast domain (192.168.1.0/28)." },
];

export function AttackGraphView({ graph, onSimulatePath, simulationResult }: AttackGraphViewProps) {
  const [showDemoGraph, setShowDemoGraph] = useState(false);

  const rawNodes = graph?.nodes || [];
  const rawEdges = graph?.edges || [];
  const isSubnet = graph?.isSubnetScan ?? rawNodes.length > 1;

  const nodes = rawNodes.length > 0 ? rawNodes : (showDemoGraph || !isSubnet ? DEFAULT_DEMO_NODES : []);
  const edges = rawEdges.length > 0 ? rawEdges : (showDemoGraph || !isSubnet ? DEFAULT_DEMO_EDGES : []);

  const [selectedNode, setSelectedNode] = useState<Node | null>(nodes[0] || null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [entryHostId, setEntryHostId] = useState<string>(nodes[0]?.ip || "192.168.1.10");
  const [entryVuln, setEntryVuln] = useState<string>("Weak SSH Credentials");
  const [localSimulation, setLocalSimulation] = useState<any>(null);

  const activeSimulation = simulationResult || localSimulation;
  const activePathHops: any[] = activeSimulation?.pathHops || [];
  const activeReachableIps: string[] = activeSimulation?.reachableHosts || [];

  const handleRunSimulation = () => {
    if (onSimulatePath && rawNodes.length > 0) {
      onSimulatePath(entryHostId, entryVuln);
    } else {
      // Local demo simulation
      const hops = [
        { hopIndex: 1, fromHost: "192.168.1.10", toHost: "192.168.1.20", protocol: "ftp", port: 21, weight: 0.90, pivotVulnerability: "FTP Backdoor Exploit (CVE-2011-2523)", description: "Attacker on 192.168.1.10 exploits vsftpd backdoor on 192.168.1.20." },
        { hopIndex: 2, fromHost: "192.168.1.20", toHost: "192.168.1.30", protocol: "smb", port: 445, weight: 0.80, pivotVulnerability: "SMB Share Lateral Movement", description: "Attacker pivots to 192.168.1.30 via SMB share enumeration." },
      ];
      setLocalSimulation({
        success: true,
        entryHost: entryHostId,
        entryVulnerability: entryVuln,
        targetHost: "192.168.1.40",
        totalHops: 2,
        pathRiskScore: 68.5,
        pathSeverity: "HIGH",
        reachableHosts: ["192.168.1.10", "192.168.1.20", "192.168.1.30", "192.168.1.40"],
        pathHops: hops,
        explanation: `Attacker gains entry on ${entryHostId} via ${entryVuln}. Pivots through 2 hops to reach high-value target 192.168.1.40.`,
      });
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
              Target: {graph.target || "192.168.1.0/28 Subnet"} · {nodes.length} Host Nodes · {edges.length} Pivot Edges
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowDemoGraph(!showDemoGraph)}
          className="px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold text-sky-400 border-sky-500/30"
          style={{ background: "rgba(56,189,248,0.1)", fontFamily: "Inter" }}
        >
          <Eye size={13} /> {showDemoGraph ? "Viewing Live Scan" : "Toggle Topology Graph Demo"}
        </button>
      </div>

      {/* Interactive Subnet Graph Canvas Simulation */}
      <div className="relative p-6 rounded-2xl overflow-hidden flex flex-col gap-6" style={{ background: "rgba(4,8,20,0.9)", border: "1px solid rgba(28,50,84,0.7)" }}>
        {/* Nodes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-10">
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const isReachable = activeReachableIps.includes(node.ip);
            const isEntry = activeSimulation?.entryHost === node.ip;
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
        {activeSimulation && activeSimulation.success && (
          <div className="p-3.5 rounded-xl flex flex-col gap-2 mt-2" style={{ background: "rgba(10,20,40,0.9)", border: "1px solid rgba(239,68,68,0.4)" }}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-red-400">
                Simulation Result: Path Risk Score {activeSimulation.pathRiskScore}/100 ({activeSimulation.pathSeverity})
              </span>
              <span className="text-xs text-slate-400">{activeSimulation.totalHops} Lateral Hops</span>
            </div>
            <p style={{ fontSize: "11px", color: "#cbd5e1", fontFamily: "Inter", lineHeight: 1.4 }}>
              {activeSimulation.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
