import { Outlet, useLocation } from "react-router";

export function MobileFrame() {
  const location = useLocation();
  const isAuthFlow = ["/", "/onboarding", "/auth"].includes(location.pathname);

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
      <div className="flex-1 flex flex-col relative w-full h-full justify-center items-center">
        {isAuthFlow ? (
          <div className="w-full h-screen flex flex-col justify-center items-center p-0 md:p-4">
            <div className="w-full h-full md:h-[85vh] md:max-h-[820px] md:max-w-[480px] md:bg-[#040b19]/60 md:border md:border-[#1c3254]/60 md:rounded-[32px] md:shadow-[0_0_50px_rgba(0,0,0,0.6)] md:backdrop-blur-xl flex flex-col overflow-hidden relative">
              <Outlet />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
