import { useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Shield, Wifi } from "lucide-react";

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/onboarding"), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full relative overflow-hidden scrollbar-hide overflow-y-auto"
      style={{ minHeight: "100%", background: "transparent" }}
    >
      {/* Animated rings */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${i * 120}px`,
            height: `${i * 120}px`,
            borderColor: `rgba(56,189,248,${0.15 / i})`,
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 1], opacity: [0, 0.6, 0.3] }}
          transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity, repeatType: "reverse" }}
        />
      ))}

      {/* Scanning line animation */}
      <motion.div
        className="absolute w-full h-0.5"
        style={{ background: "linear-gradient(90deg, transparent, #38bdf8, transparent)", opacity: 0.4 }}
        initial={{ top: "20%", opacity: 0 }}
        animate={{ top: ["20%", "80%", "20%"], opacity: [0, 0.6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Logo */}
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "backOut" }}
      >
        <div
          className="relative flex items-center justify-center rounded-3xl"
          style={{
            width: "88px",
            height: "88px",
            background: "linear-gradient(135deg, #0f2a4a 0%, #0d1f3c 100%)",
            border: "1.5px solid rgba(56,189,248,0.4)",
            boxShadow: "0 0 30px rgba(56,189,248,0.3), 0 0 60px rgba(59,130,246,0.15)",
          }}
        >
          <Shield size={40} style={{ color: "#38bdf8" }} strokeWidth={1.5} />
          {/* Port indicator dots */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: "5px",
                height: "5px",
                background: "#22c55e",
                top: `${20 + i * 15}%`,
                right: "10%",
              }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, delay: i * 0.25, repeat: Infinity }}
            />
          ))}
        </div>

        <motion.div
          className="text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div style={{ fontSize: "26px", fontWeight: 800, color: "#e8f0fe", letterSpacing: "-0.5px", fontFamily: "Inter" }}>
            Port<span style={{ color: "#38bdf8" }}>Sentinel</span>
          </div>
          <div style={{ fontSize: "12px", color: "#4a6080", marginTop: "4px", letterSpacing: "1.5px", fontFamily: "Inter" }}>
            NETWORK SECURITY SCANNER
          </div>
        </motion.div>
      </motion.div>

      {/* Version & loading */}
      <motion.div
        className="absolute bottom-16 flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {/* Loading dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ width: "6px", height: "6px", background: "#38bdf8" }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
            />
          ))}
        </div>
        <div style={{ fontSize: "11px", color: "#2a3f5e", fontFamily: "Inter" }}>
          v1.0.0 — Lightweight & Fast
        </div>
      </motion.div>

      {/* Bottom feature icons */}
      <motion.div
        className="absolute bottom-6 flex gap-6 items-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        {["Fast", "Secure", "Simple"].map((text, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="rounded-full" style={{ width: "4px", height: "4px", background: "#22c55e" }} />
            <span style={{ fontSize: "10px", color: "#3a5070", fontFamily: "Inter" }}>{text}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}