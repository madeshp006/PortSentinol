import { Outlet } from "react-router";

export function MobileFrame() {
  return (
    <div
      className="min-h-screen w-screen flex flex-col bg-[#020812] overflow-x-hidden relative"
      style={{ background: "linear-gradient(135deg, #020812 0%, #050d1f 50%, #030a18 100%)" }}
    >
      {/* Ambient glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08), transparent)" }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.06), transparent)" }}
        />
      </div>

      {/* Screen Content - fills remaining space */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        <Outlet />
      </div>
    </div>
  );
}
