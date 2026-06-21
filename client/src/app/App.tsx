import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { AlertsProvider } from "./context/AlertsContext";
import { SocketProvider } from "./context/SocketContext";
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AlertsProvider>
          <RouterProvider router={router} />
          <SpeedInsights />
        </AlertsProvider>
      </SocketProvider>
    </AuthProvider>
  );
}