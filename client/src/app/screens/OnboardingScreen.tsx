import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Radar, ShieldAlert, Zap, ChevronRight } from "lucide-react";

const slides = [
  {
    icon: Radar,
    color: "#38bdf8",
    gradientFrom: "#0f2d4d",
    gradientTo: "#071825",
    title: "Scan Any Network",
    subtitle: "Discover open ports and running services across IPs and subnets in seconds.",
    features: ["IP & subnet scanning", "1–65535 port range", "Fast UDP/TCP detection"],
  },
  {
    icon: ShieldAlert,
    color: "#f59e0b",
    gradientFrom: "#2d1e05",
    gradientTo: "#1a1205",
    title: "Detect Risks Instantly",
    subtitle: "Instantly identify misconfigurations, exposed services, and critical vulnerabilities.",
    features: ["Severity scoring", "CVE references", "Zero false-positive alerts"],
  },
  {
    icon: Zap,
    color: "#22c55e",
    gradientFrom: "#0d2a18",
    gradientTo: "#071510",
    title: "Fix & Stay Secure",
    subtitle: "Get step-by-step mitigation guides and schedule automated scans.",
    features: ["Guided fix suggestions", "Scheduled scanning", "PDF report export"],
  },
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const Icon = slide.icon;

  const handleNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="flex flex-col overflow-y-auto scrollbar-hide" style={{ height: "100%", minHeight: "100%" }}>
      {/* Skip button */}
      <div className="flex justify-end px-6 pt-4 pb-2">
        <button
          onClick={() => navigate("/auth")}
          style={{ fontSize: "13px", color: "#4a6080", fontFamily: "Inter", fontWeight: 500 }}
        >
          Skip
        </button>
      </div>

      {/* Illustration area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col items-center px-6 pt-4"
        >
          {/* Icon card */}
          <div
            className="relative flex items-center justify-center rounded-3xl mb-6"
            style={{
              width: "140px",
              height: "140px",
              background: `linear-gradient(135deg, ${slide.gradientFrom} 0%, ${slide.gradientTo} 100%)`,
              border: `1.5px solid ${slide.color}30`,
              boxShadow: `0 0 40px ${slide.color}20`,
            }}
          >
            {/* Animated circle rings */}
            {[1, 1.5].map((scale, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border"
                style={{
                  inset: `-${i * 16}px`,
                  borderColor: `${slide.color}15`,
                }}
                animate={{ scale: [1, scale, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 2.5, delay: i * 0.5, repeat: Infinity }}
              />
            ))}
            <Icon size={56} color={slide.color} strokeWidth={1.5} />
          </div>

          {/* Text content */}
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#e8f0fe",
              textAlign: "center",
              marginBottom: "12px",
              fontFamily: "Inter",
              letterSpacing: "-0.3px",
            }}
          >
            {slide.title}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#6a8aaa",
              textAlign: "center",
              lineHeight: 1.6,
              marginBottom: "28px",
              fontFamily: "Inter",
            }}
          >
            {slide.subtitle}
          </p>

          {/* Feature chips */}
          <div className="flex flex-col gap-2.5 w-full max-w-[280px]">
            {slide.features.map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: "rgba(13, 26, 48, 0.8)",
                  border: "1px solid rgba(28, 50, 84, 0.6)",
                }}
              >
                <div
                  className="rounded-full"
                  style={{ width: "6px", height: "6px", background: slide.color, flexShrink: 0 }}
                />
                <span style={{ fontSize: "13px", color: "#8899b8", fontFamily: "Inter" }}>{feat}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom area */}
      <div className="mt-auto px-6 pb-10 flex flex-col items-center gap-6">
        {/* Dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              animate={{
                width: i === current ? "20px" : "6px",
                background: i === current ? slide.color : "#1c3254",
              }}
              style={{ height: "6px" }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Next button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-4"
          style={{
            background: `linear-gradient(135deg, ${slide.color}30, ${slide.color}18)`,
            border: `1px solid ${slide.color}50`,
            color: slide.color,
            fontSize: "15px",
            fontWeight: 600,
            fontFamily: "Inter",
          }}
        >
          {current < slides.length - 1 ? (
            <>Continue <ChevronRight size={18} /></>
          ) : (
            <>Get Started <ChevronRight size={18} /></>
          )}
        </motion.button>
      </div>
    </div>
  );
}