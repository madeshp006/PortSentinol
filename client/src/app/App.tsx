import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./context/AuthContext";
import { AlertsProvider } from "./context/AlertsContext";
import { SocketProvider } from "./context/SocketContext";

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AlertsProvider>
          <RouterProvider router={router} />
        </AlertsProvider>
      </SocketProvider>
    </AuthProvider>
  );
}