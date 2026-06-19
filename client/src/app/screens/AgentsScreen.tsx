import * as React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft, RefreshCw, Cpu, Laptop, Terminal, Trash2,
  Search, Copy, Check, Info, Server, HelpCircle, Download,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import * as api from "../utils/api";
import { safeCopy } from "../utils/clipboard";

const filterOptions = ["All", "Online", "Offline"];

const cardStyle = {
  background: "rgba(10,20,40,0.8)",
  border: "1px solid rgba(28,50,84,0.8)",
  borderRadius: "16px",
};

export function AgentsScreen() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const socket = useSocket();

  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [tokenCopied, setTokenCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownloadAgent = () => {
    if (!token) return;
    const url = `${api.getApiBaseUrl()}/agents/download?token=${encodeURIComponent(token)}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "portsentinel-agent.zip");
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  };

  const loadAgents = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getAgents(token);
      setAgents(data);
    } catch (e: any) {
      console.log("Load agents error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, [token]);

  // Handle real-time agent status updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleAgentStatus = (data: any) => {
      setAgents((prev) => {
        if (data.deleted) {
          return prev.filter((a) => a.agentId !== data.agentId);
        }
        if (prev.some((a) => a.agentId === data.agentId)) {
          return prev.map((a) => (a.agentId === data.agentId ? { ...a, ...data.agent } : a));
        }
        return [data.agent, ...prev];
      });
    };

    socket.on("agent:status", handleAgentStatus);

    return () => {
      socket.off("agent:status", handleAgentStatus);
    };
  }, [socket]);

  const deleteAgent = async (id: string) => {
    if (!token) return;
    setAgents((prev) => prev.filter((a) => a.id !== id));
    try {
      await api.deleteAgent(token, id);
    } catch (e: any) {
      console.log("Delete agent error:", e.message);
      loadAgents(); // reload on error
    }
  };

  const handleCopyToken = () => {
    if (!token) return;
    safeCopy(token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleCopyId = (id: string, text: string) => {
    safeCopy(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter and Search computations
  const filteredAgents = agents.filter((agent) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      agent.name.toLowerCase().includes(term) ||
      agent.agentId.toLowerCase().includes(term) ||
      agent.deviceName.toLowerCase().includes(term) ||
      agent.operatingSystem.toLowerCase().includes(term);

    const matchesStatus =
      activeFilter === "All" ||
      (activeFilter === "Online" && agent.status === "online") ||
      (activeFilter === "Offline" && agent.status === "offline");

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="pb-8" style={{ minHeight: "780px" }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/app/profile")}
          className="flex items-center justify-center rounded-xl"
          style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div className="flex-1">
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Security Agents</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>
            {loading ? "Loading…" : `${agents.filter((a) => a.status === "online").length} active agents online`}
          </p>
        </div>
        <button
          onClick={loadAgents}
          disabled={loading}
          className="flex items-center justify-center rounded-xl"
          style={{ width: 32, height: 32, background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <motion.div
            animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
          >
            <RefreshCw size={13} style={{ color: "#38bdf8" }} />
          </motion.div>
        </button>
      </div>

      {/* Guide: How to run agent */}
      <div className="mx-5 mb-4 p-4 rounded-2xl" style={{ ...cardStyle, background: "rgba(56, 189, 248, 0.04)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={14} style={{ color: "#38bdf8" }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#38bdf8", fontFamily: "Inter" }}>
            How to run a local Agent
          </span>
        </div>
        <p style={{ fontSize: "11px", color: "#6a8aaa", fontFamily: "Inter", lineHeight: 1.5, marginBottom: 12 }}>
          To scan private networks (e.g. 192.168.x.x), download and launch the PortSentinel Agent locally:
        </p>
        <div className="flex flex-col gap-1.5 mb-4" style={{ fontFamily: "monospace", fontSize: "10px", color: "#8899b8" }}>
          <div className="flex items-center gap-2">
            <span className="text-sky-400">1.</span> Open terminal in the <span className="text-violet-400">agent/</span> project directory.
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sky-400">2.</span> Run <span className="text-emerald-400">npm install</span> to build dependencies.
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sky-400">3.</span> Start execution with <span className="text-emerald-400">npm start</span> (or `install.bat`).
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sky-400">4.</span> Supply backend URL and your <span className="text-amber-400">User API Key</span>.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownloadAgent}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl"
            style={{
              background: "rgba(56,189,248,0.08)",
              border: "1px solid rgba(56,189,248,0.25)",
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: 600,
              fontFamily: "Inter",
            }}
          >
            <Download size={13} />
            Download Agent ZIP
          </button>

          <button
            onClick={handleCopyToken}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl"
            style={{
              background: tokenCopied ? "rgba(34,197,94,0.12)" : "rgba(168,85,247,0.08)",
              border: tokenCopied ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(168,85,247,0.25)",
              color: tokenCopied ? "#22c55e" : "#c084fc",
              fontSize: "11px",
              fontWeight: 600,
              fontFamily: "Inter",
            }}
          >
            {tokenCopied ? <Check size={13} /> : <Copy size={13} />}
            {tokenCopied ? "User Key Copied!" : "Copy User API Key"}
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-5 mb-4 flex flex-col gap-3">
        {/* Search */}
        <div className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: "rgba(10,20,40,0.6)", border: "1px solid rgba(28,50,84,0.7)" }}>
          <Search size={14} style={{ color: "#3a5070" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by Name, ID, Device, OS..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#c8d8f0", fontSize: "13px", fontFamily: "Inter" }}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {filterOptions.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className="flex-1 py-1.5 rounded-xl text-center"
              style={{
                background: activeFilter === f ? "rgba(56,189,248,0.1)" : "rgba(10,20,40,0.4)",
                border: activeFilter === f ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(28,50,84,0.6)",
                color: activeFilter === f ? "#38bdf8" : "#4a6080",
                fontSize: "11px",
                fontWeight: activeFilter === f ? 600 : 400,
                fontFamily: "Inter",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-5 flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-4 animate-pulse"
              style={{ height: 110, background: "rgba(10,20,40,0.5)", border: "1px solid rgba(28,50,84,0.5)" }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAgents.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Cpu size={36} style={{ color: "#2a3f5e" }} />
          <p style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter" }}>
            {agents.length === 0 ? "No agents registered yet." : "No matching agents found."}
          </p>
        </div>
      )}

      {/* Agent list */}
      {!loading && (
        <div className="px-5 flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {filteredAgents.map((agent, i) => {
              const isOnline = agent.status === "online";
              const timeString = agent.lastSeen
                ? new Date(agent.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Never";

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4"
                  style={cardStyle}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className="flex items-center justify-center rounded-xl"
                      style={{
                        width: "38px",
                        height: "38px",
                        background: isOnline ? "rgba(34,197,94,0.08)" : "rgba(28,50,84,0.3)",
                        border: isOnline ? "1px solid rgba(34,197,94,0.18)" : "1px solid rgba(28,50,84,0.4)",
                        flexShrink: 0,
                      }}
                    >
                      <Cpu size={18} style={{ color: isOnline ? "#22c55e" : "#4a6080" }} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>
                          {agent.name}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
                          style={{
                            background: isOnline ? "rgba(34,197,94,0.12)" : "rgba(74,96,128,0.12)",
                            color: isOnline ? "#22c55e" : "#6a8aaa",
                          }}
                        >
                          {isOnline ? "ONLINE" : "OFFLINE"}
                        </span>
                      </div>

                      {/* Agent ID */}
                      <button
                        onClick={() => handleCopyId(agent.id, agent.agentId)}
                        className="flex items-center gap-1 mt-1 group"
                        style={{ background: "transparent", border: "none", outline: "none", cursor: "pointer" }}
                      >
                        <span style={{ fontSize: "9px", color: "#3a5070", fontFamily: "monospace" }}>
                          ID: {agent.agentId}
                        </span>
                        {copiedId === agent.id ? (
                          <Check size={9} style={{ color: "#22c55e" }} />
                        ) : (
                          <Copy size={9} className="opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ color: "#3a5070" }} />
                        )}
                      </button>

                      {/* Hardware / Environment info */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(28,50,84,0.4)" }}>
                        <div className="flex items-center gap-1.5">
                          <Laptop size={11} style={{ color: "#4a6080" }} />
                          <span style={{ fontSize: "10px", color: "#6a8aaa", fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {agent.deviceName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Server size={11} style={{ color: "#4a6080" }} />
                          <span style={{ fontSize: "10px", color: "#6a8aaa", fontFamily: "Inter", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {agent.operatingSystem} ({agent.version})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-3 justify-between h-[65px]">
                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className="flex items-center justify-center rounded-xl"
                        style={{
                          width: "30px",
                          height: "30px",
                          background: "rgba(239,68,68,0.06)",
                          border: "1px solid rgba(239,68,68,0.12)",
                          color: "#ef4444",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                      <span style={{ fontSize: "8px", color: "#3a5070", fontFamily: "Inter" }}>
                        Ping: {timeString}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
