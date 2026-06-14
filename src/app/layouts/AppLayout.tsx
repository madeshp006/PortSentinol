import { Outlet, useNavigate, useLocation } from "react-router";
import { BottomNav } from "../components/BottomNav";
import { LayoutDashboard, Radar, Clock, Bell, User, LogOut, ShieldAlert } from "lucide-react";
import { useAlerts } from "../context/AlertsContext";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { icon: LayoutDashboard, label: "Home", path: "/app" },
  { icon: Radar, label: "Scan", path: "/app/scan" },
  { icon: Clock, label: "History", path: "/app/history" },
  { icon: Bell, label: "Alerts", path: "/app/notifications" },
  { icon: User, label: "Profile", path: "/app/profile" },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useAlerts();
  const { logout, profile } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#020813] text-[#e2e8f0]">
      {/* Desktop Sidebar (visible on md and larger) */}
      <div 
        className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-[#1c3254]/80"
        style={{
          background: "linear-gradient(180deg, #070d1e 0%, #030712 100%)",
        }}
      >
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 px-6 py-6 border-b border-[#1c3254]/40">
          <div className="flex items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30 p-2">
            <ShieldAlert size={22} className="text-sky-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              PortSentinel
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Security Control
            </p>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto scrollbar-hide">
          {navItems.map(({ icon: Icon, label, path }) => {
            const isActive =
              path === "/app"
                ? location.pathname === "/app" || location.pathname === "/app/"
                : location.pathname.startsWith(path);

            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  color: isActive ? "#38bdf8" : "#8899b8",
                  background: isActive ? "rgba(56,189,248,0.08)" : "transparent",
                  border: isActive ? "1px solid rgba(56,189,248,0.15)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                {label === "Alerts" && unreadCount > 0 && (
                  <span className="flex items-center justify-center rounded-full bg-red-500 text-white font-bold text-[9px] w-5 h-5">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-[#1c3254]/40 bg-black/10 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-bold text-sm text-white uppercase shadow-md shadow-sky-500/10">
              {profile?.name?.charAt(0) || "O"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">{profile?.name || "Operator"}</p>
              <p className="text-[10px] text-slate-500 truncate">{profile?.role || "Security Analyst"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition-colors text-xs font-bold"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Main Content Scroll Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <div className="w-full max-w-6xl mx-auto py-2 md:py-6">
            <Outlet />
          </div>
        </div>

        {/* Mobile Navigation (hidden on md and larger) */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
