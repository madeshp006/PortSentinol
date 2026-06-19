import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getApiBaseUrl } from "../utils/api";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Determine Socket URL: backend port is 5000
    const apiBase = getApiBaseUrl();
    const wsUrl = apiBase.startsWith("http")
      ? apiBase.replace(/\/api$/, "")
      : window.location.origin.replace(/:\d+$/, ":5000");

    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("Socket.IO connected to PortSentinel backend");
    });

    newSocket.on("connect_error", (err) => {
      console.warn("Socket.IO connection error:", err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
