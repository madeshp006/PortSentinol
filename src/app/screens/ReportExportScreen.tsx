import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ChevronLeft, FileText, Download, Share2, Mail, CheckCircle2,
  Shield, AlertTriangle, Activity, Server, Calendar, Clock,
} from "lucide-react";

const reportSections = [
  { id: "summary", label: "Executive Summary", enabled: true, icon: Shield },
  { id: "ports", label: "Open Ports List", enabled: true, icon: Activity },
  { id: "misconfig", label: "Misconfigurations", enabled: true, icon: AlertTriangle },
  { id: "risk", label: "Risk Severity Analysis", enabled: true, icon: AlertTriangle },
  { id: "mitigation", label: "Mitigation Steps", enabled: true, icon: CheckCircle2 },
  { id: "services", label: "Service Details", enabled: false, icon: Server },
  { id: "history", label: "Scan History", enabled: false, icon: Clock },
];

export function ReportExportScreen() {
  const navigate = useNavigate();
  const [sections, setSections] = useState(reportSections);
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
    }, 2500);
  };

  return (
    <div className="pb-6" style={{ minHeight: "780px" }}>
      {/* Header */}
      <div className="px-5 pt-4 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center justify-center rounded-xl"
          style={{ width: "36px", height: "36px", background: "rgba(10,20,40,0.8)", border: "1px solid rgba(28,50,84,0.8)" }}
        >
          <ChevronLeft size={18} style={{ color: "#8899b8" }} />
        </button>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e8f0fe", fontFamily: "Inter" }}>Export Report</h2>
          <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>192.168.1.0/24 · Apr 2, 2026</p>
        </div>
      </div>

      {/* PDF Preview card */}
      <div className="mx-5 mb-5 rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(28,50,84,0.8)", background: "rgba(10,20,40,0.8)" }}>
        {/* PDF header */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, rgba(14,107,176,0.25), rgba(10,79,138,0.15))", borderBottom: "1px solid rgba(28,50,84,0.6)" }}
        >
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: "44px", height: "44px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.25)" }}
          >
            <FileText size={22} style={{ color: "#38bdf8" }} strokeWidth={1.5} />
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#c8d8f0", fontFamily: "Inter" }}>
              PortSentinel_Report_2026-04-02.pdf
            </p>
            <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter" }}>Estimated size: 1.4 MB</p>
          </div>
        </div>

        {/* Preview details */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Target", value: "192.168.1.0/24" },
              { label: "Scan Date", value: "Apr 2, 2026" },
              { label: "Risk Score", value: "34/100" },
            ].map((d) => (
              <div key={d.label}>
                <p style={{ fontSize: "9px", color: "#2a3f5e", fontFamily: "Inter", textTransform: "uppercase" }}>{d.label}</p>
                <p style={{ fontSize: "11px", color: "#8899b8", fontFamily: "Inter", fontWeight: 500, marginTop: "2px" }}>{d.value}</p>
              </div>
            ))}
          </div>

          {/* Page indicators */}
          <div className="flex gap-2">
            {["Cover", "Summary", "Ports", "Risks", "Fixes"].map((page) => (
              <div
                key={page}
                className="flex-1 py-2 rounded-lg text-center"
                style={{ background: "rgba(7,13,30,0.8)", border: "1px solid rgba(28,50,84,0.5)" }}
              >
                <p style={{ fontSize: "9px", color: "#3a5070", fontFamily: "Inter" }}>{page}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Format selector */}
      <div className="px-5 mb-4">
        <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Format
        </p>
        <div className="flex gap-2">
          {(["pdf", "csv", "json"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className="flex-1 py-2.5 rounded-xl uppercase"
              style={{
                background: format === f ? "rgba(56,189,248,0.12)" : "rgba(10,20,40,0.6)",
                border: format === f ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(28,50,84,0.6)",
                color: format === f ? "#38bdf8" : "#4a6080",
                fontSize: "12px",
                fontWeight: format === f ? 700 : 400,
                fontFamily: "Inter",
                letterSpacing: "1px",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Section toggles */}
      <div className="px-5 mb-5">
        <p style={{ fontSize: "11px", color: "#4a6080", fontFamily: "Inter", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          Include Sections
        </p>
        <div className="flex flex-col gap-2">
          {sections.map((section) => (
            <div
              key={section.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(10,20,40,0.6)", border: "1px solid rgba(28,50,84,0.5)" }}
            >
              <section.icon size={15} style={{ color: section.enabled ? "#38bdf8" : "#3a5070" }} />
              <span style={{ flex: 1, fontSize: "13px", color: section.enabled ? "#c8d8f0" : "#4a6080", fontFamily: "Inter" }}>
                {section.label}
              </span>
              <button
                onClick={() => toggleSection(section.id)}
                className="rounded-full transition-all duration-200"
                style={{
                  width: "36px",
                  height: "20px",
                  background: section.enabled ? "rgba(56,189,248,0.3)" : "rgba(28,50,84,0.8)",
                  border: section.enabled ? "1px solid rgba(56,189,248,0.4)" : "1px solid rgba(28,50,84,0.5)",
                  position: "relative",
                }}
              >
                <div
                  className="rounded-full absolute top-0.5 transition-all duration-200"
                  style={{
                    width: "14px",
                    height: "14px",
                    background: section.enabled ? "#38bdf8" : "#3a5070",
                    left: section.enabled ? "18px" : "2px",
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {!generated ? (
        <div className="px-5 flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={generate}
            disabled={generating}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
            style={{
              background: "linear-gradient(135deg, #0e6bb0, #0a4f8a)",
              border: "1px solid rgba(56,189,248,0.35)",
              color: "#e8f4ff",
              fontSize: "15px",
              fontWeight: 600,
              fontFamily: "Inter",
              boxShadow: "0 4px 20px rgba(56,189,248,0.2)",
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? (
              <>
                <motion.div
                  className="rounded-full border-2 border-t-transparent"
                  style={{ width: "18px", height: "18px", borderColor: "#e8f4ff" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Generating Report...
              </>
            ) : (
              <>
                <Download size={18} />
                Generate & Download
              </>
            )}
          </motion.button>

          <div className="flex gap-3">
            <button
              className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
              style={{
                background: "rgba(10,20,40,0.7)",
                border: "1px solid rgba(28,50,84,0.7)",
                color: "#8899b8",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "Inter",
              }}
            >
              <Mail size={16} /> Email
            </button>
            <button
              className="flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2"
              style={{
                background: "rgba(10,20,40,0.7)",
                border: "1px solid rgba(28,50,84,0.7)",
                color: "#8899b8",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "Inter",
              }}
            >
              <Share2 size={16} /> Share
            </button>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-5 rounded-2xl p-5 text-center"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
        >
          <CheckCircle2 size={32} style={{ color: "#22c55e", margin: "0 auto 10px" }} />
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#22c55e", fontFamily: "Inter" }}>Report Ready!</p>
          <p style={{ fontSize: "12px", color: "#4a8060", fontFamily: "Inter", marginTop: "4px", marginBottom: "16px" }}>
            PortSentinel_Report_2026-04-02.{format} saved to your device
          </p>
          <button
            onClick={() => setGenerated(false)}
            className="px-6 py-2.5 rounded-xl"
            style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontSize: "13px", fontFamily: "Inter" }}
          >
            Generate Another
          </button>
        </motion.div>
      )}
    </div>
  );
}
