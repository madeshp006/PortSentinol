import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { token, loading } = useAuth();

  if (loading) {
    // Render a tiny dark spinner while we rehydrate localStorage
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "100%", background: "transparent" }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2.5px solid rgba(56,189,248,0.15)",
            borderTop: "2.5px solid #38bdf8",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}
