import { useNavigate, useLocation } from "react-router";
import { LayoutDashboard, Radar, Clock, Bell, User } from "lucide-react";
import { useAlerts } from "../context/AlertsContext";
import { useAuth } from "../context/AuthContext";

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useAlerts();
  const { profile } = useAuth();

  const role = profile?.role || "USER";
  const navItems = [];

  if (role === "SUPER_ADMIN") {
    navItems.push({ icon: LayoutDashboard, label: "Admin", path: "/app/admin" });
  } else if (role === "SECURITY_ANALYST") {
    navItems.push({ icon: LayoutDashboard, label: "Analyst", path: "/app/analyst" });
  } else {
    navItems.push({ icon: LayoutDashboard, label: "Home", path: "/app" });
  }

  navItems.push({ icon: Radar, label: "Scan", path: "/app/scan" });
  navItems.push({ icon: Clock, label: "History", path: "/app/history" });
  navItems.push({ icon: Bell, label: "Alerts", path: "/app/notifications" });
  navItems.push({ icon: User, label: "Profile", path: "/app/profile" });

  return (
    <div
      className="shrink-0 flex items-center justify-around px-2 pt-2 pb-3"
      style={{
        background: "linear-gradient(to top, #060c1a, #070d1ecc)",
        borderTop: "1px solid rgba(28, 50, 84, 0.8)",
        backdropFilter: "blur(10px)",
      }}
    >
      {navItems.map(({ icon: Icon, label, path }) => {
        const isActive =
          path === "/app"
            ? location.pathname === "/app" || location.pathname === "/app/"
            : location.pathname.startsWith(path);

        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all duration-200 relative"
            style={{
              color: isActive ? "#38bdf8" : "#4a6080",
              background: isActive ? "rgba(56,189,248,0.08)" : "transparent",
              minWidth: "52px",
            }}
          >
            <div className="relative">
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              {label === "Alerts" && unreadCount > 0 && (
                <span
                  className="absolute flex items-center justify-center rounded-full"
                  style={{
                    top: "-4px",
                    right: "-6px",
                    width: "14px",
                    height: "14px",
                    background: "#ef4444",
                    fontSize: "8px",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: "10px", fontWeight: isActive ? 600 : 400 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
