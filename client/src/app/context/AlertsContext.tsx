import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import * as api from "../utils/api";

interface AlertsContextValue {
  alerts: any[];
  unreadCount: number;
  loading: boolean;
  reload: () => Promise<void>;
  updateAlerts: (alerts: any[]) => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socket = useSocket();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (newAlert: any) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });
    };

    socket.on("alert:new", handleNewAlert);

    return () => {
      socket.off("alert:new", handleNewAlert);
    };
  }, [socket]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getAlerts(token);
      setAlerts(data);
    } catch (e: any) {
      console.log("AlertsContext load error:", e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      reload();
    } else {
      setAlerts([]);
    }
  }, [token, reload]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <AlertsContext.Provider
      value={{ alerts, unreadCount, loading, reload, updateAlerts: setAlerts }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used inside <AlertsProvider>");
  return ctx;
}
