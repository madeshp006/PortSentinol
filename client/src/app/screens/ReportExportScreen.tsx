import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft, FileText, Download, Share2, Mail, CheckCircle2,
  Shield, AlertTriangle, Activity, Server, Clock, X, ChevronDown
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

const reportSections = [
  { id: "summary", label: "Executive Summary", enabled: true, icon: Shield },
  { id: "ports", label: "Open Ports List", enabled: true, icon: Activity },
  { id: "misconfig", label: "Misconfigurations", enabled: true, icon: AlertTriangle },
  { id: "risk", label: "Risk Severity Analysis", enabled: true, icon: AlertTriangle },
  { id: "mitigation", label: "Mitigation Steps", enabled: true, icon: CheckCircle2 },
];

export function ReportExportScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  
  const [scans, setScans] = useState<any[]>([]);
  const [selectedScan, setSelectedScan] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sections, setSections] = useState(reportSections);
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Email Modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    const fetchScans = async () => {
      if (!token) return;
      try {
        const data = await api.getScans(token);
        const completed = data.filter((s) => s.status === "completed");
        setScans(completed);
        
        // If navigate state has a scan, use it
        if (location.state?.scan) {
          setSelectedScan(location.state.scan);
        } else if (completed.length > 0) {
          setSelectedScan(completed[0]);
        }
      } catch (err: any) {
        setError("Failed to retrieve completed scans list");
      }
    };
    fetchScans();
  }, [token, location.state]);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleDownload = async () => {
    if (!selectedScan || !token) return;
    setGenerating(true);
    setError("");
    
    try {
      // Small simulated delay for premium UX feel
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const downloadUrl = `${api.getApiBaseUrl()}/scans/${selectedScan.id}/export/${format}?token=${token}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute(
        "download",
        `PortSentinel_Report_${selectedScan.target.replace(/[^a-zA-Z0-9]/g, "_")}.${format}`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setGenerated(true);
    } catch (err: any) {
      setError(err.message || "Failed to download report");
    } finally {
      setGenerating(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScan || !token || !emailInput.trim()) return;
    
    setEmailSending(true);
    setError("");
    setSuccess("");
    
    try {
      await api.emailReport(token, selectedScan.id, emailInput.trim());
      setSuccess(`Report successfully emailed to ${emailInput.trim()}`);
      setShowEmailModal(false);
      setEmailInput("");
    } catch (err: any) {
      setError(err.message || "Failed to email report");
    } finally {
      setEmailSending(false);
    }
  };

  const handleShare = () => {
    if (!selectedScan || !token) return;
    setError("");
    setSuccess("");
    
    try {
      const shareUrl = `${window.location.origin}${api.getApiBaseUrl()}/scans/${selectedScan.id}/export/${format}?token=${token}`;
      
      if (navigator.share) {
        navigator.share({
          title: `PortSentinel Security Report - ${selectedScan.target}`,
          text: `Download the vulnerability assessment report for target ${selectedScan.target}`,
          url: shareUrl,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl);
        setSuccess("Report download link copied to clipboard!");
      }
    } catch (err: any) {
      setError("Failed to copy link");
    }
  };

  // Details calculations
  let portsList = [];
  if (selectedScan && selectedScan.ports) {
    portsList = typeof selectedScan.ports === "string" ? JSON.parse(selectedScan.ports) : selectedScan.ports;
  }

  return (
    <div className="pb-8 px-4 md:px-6" style={{ minHeight: "800px", fontFamily: "Inter" }}>
      {/* Header */}
      <div className="pt-4 pb-4 flex items-center gap-3 border-b border-[#1c3254]/40 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center rounded-xl bg-slate-900 border border-[#1c3254]/80 p-2 text-slate-400 hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#e8f0fe]">Export Vulnerability Report</h2>
          <p className="text-xs text-[#4a6080]">Download details, share or email security summaries</p>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
      {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">{success}</div>}

      {/* Target Selector Dropdown */}
      <div className="mb-6 relative">
        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Select Scan Result</label>
        {scans.length === 0 ? (
          <div className="p-3 rounded-xl bg-slate-900/40 border border-[#1c3254]/30 text-xs text-slate-500 italic text-center">
            No completed scans found to export.
          </div>
        ) : (
          <>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/60 border border-[#1c3254]/50 text-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
            >
              <span>{selectedScan ? `${selectedScan.target} (${new Date(selectedScan.requestedAt).toLocaleDateString()})` : "Select a scan..."}</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-20 w-full mt-1 max-h-[220px] overflow-y-auto bg-slate-900 border border-[#1c3254] rounded-xl shadow-xl divide-y divide-[#1c3254]/30 scrollbar-hide"
                >
                  {scans.map((scan) => (
                    <button
                      key={scan.id}
                      onClick={() => {
                        setSelectedScan(scan);
                        setDropdownOpen(false);
                        setGenerated(false);
                      }}
                      className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors"
                    >
                      <div className="font-bold font-mono">{scan.target}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {scan.scanType} • {new Date(scan.requestedAt).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {selectedScan && (
        <>
          {/* PDF Preview card */}
          <div className="mb-6 rounded-xl overflow-hidden border border-[#1c3254]/60 bg-slate-900/40 shadow-lg">
            <div className="px-5 py-4 flex items-center gap-3 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border-b border-[#1c3254]/40">
              <div className="flex items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/25 p-2.5 text-sky-400">
                <FileText size={20} strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200 truncate">
                  PortSentinel_Report_{selectedScan.target.replace(/[^a-zA-Z0-9]/g, "_")}.{format}
                </p>
                <p className="text-[10px] text-slate-500">
                  {portsList.length} services identified • {selectedScan.scanType}
                </p>
              </div>
            </div>

            {/* Preview details */}
            <div className="px-5 py-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "IP Target", value: selectedScan.target },
                  { label: "Assessment Date", value: new Date(selectedScan.requestedAt).toLocaleDateString() },
                  { label: "Risk Score", value: `${selectedScan.riskScore}/100` },
                ].map((d) => (
                  <div key={d.label}>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{d.label}</p>
                    <p className="text-xs text-slate-300 font-semibold mt-1 truncate">{d.value}</p>
                  </div>
                ))}
              </div>

              {/* Page indicators */}
              <div className="flex gap-2">
                {["Cover", "Summary", "Ports Details", "Mitigation"].map((page) => (
                  <div key={page} className="flex-1 py-1.5 rounded-lg text-center bg-slate-950/60 border border-[#1c3254]/30">
                    <p className="text-[9px] text-slate-500 font-semibold">{page}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Format selector */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Output Format</label>
            <div className="flex gap-3">
              {(["pdf", "csv", "json"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFormat(f);
                    setGenerated(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl uppercase transition-all"
                  style={{
                    background: format === f ? "rgba(56,189,248,0.12)" : "rgba(10,20,40,0.6)",
                    border: format === f ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(28,50,84,0.6)",
                    color: format === f ? "#38bdf8" : "#4a6080",
                    fontSize: "12px",
                    fontWeight: format === f ? 700 : 400,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Section toggles */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Include Report Modules</label>
            <div className="flex flex-col gap-2">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/40 border border-[#1c3254]/30"
                >
                  <section.icon size={15} className={section.enabled ? "text-sky-400" : "text-slate-600"} />
                  <span className={`flex-1 text-xs ${section.enabled ? "text-slate-200 font-semibold" : "text-slate-500"}`}>
                    {section.label}
                  </span>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="rounded-full w-9 h-5 bg-slate-800 border border-slate-700 relative transition-colors"
                    style={{
                      backgroundColor: section.enabled ? "rgba(56,189,248,0.2)" : "",
                      borderColor: section.enabled ? "#38bdf8" : "",
                    }}
                  >
                    <div
                      className={`rounded-full w-3.5 h-3.5 absolute top-0.5 transition-all ${
                        section.enabled ? "bg-sky-400 left-[18px]" : "bg-slate-500 left-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          {!generated ? (
            <div className="flex flex-col gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleDownload}
                disabled={generating}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-500/10 transition-all disabled:opacity-75"
              >
                {generating ? (
                  <>
                    <motion.div
                      className="rounded-full border-2 border-t-transparent w-4.5 h-4.5 border-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Packaging modules...
                  </>
                ) : (
                  <>
                    <Download size={16} /> Compile & Download
                  </>
                )}
              </motion.button>

              <button
                onClick={handleShare}
                className="w-full py-3.5 rounded-xl bg-slate-900/60 border border-[#1c3254]/60 text-slate-300 hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-500/5 transition-all"
              >
                <Share2 size={14} /> Copy Report Download Link
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl p-5 text-center bg-emerald-500/10 border border-emerald-500/20"
            >
              <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-400">Report Package Ready!</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                PortSentinel_Report_{selectedScan.target.replace(/[^a-zA-Z0-9]/g, "_")}.{format} downloaded
              </p>
              <button
                onClick={() => setGenerated(false)}
                className="px-5 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition-colors"
              >
                Generate Another Format
              </button>
            </motion.div>
          )}
        </>
      )}


    </div>
  );
}
