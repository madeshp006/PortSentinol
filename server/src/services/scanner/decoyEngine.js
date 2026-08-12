import net from "node:net";
import { logAudit } from "../audit.js";
import { dispatchDecoyProbeAlert } from "./alertDispatcher.js";

/**
 * Deception-Based Detection Engine (Decoy Traps & Honeypots) for PortSentinel.
 * Spins up lightweight, isolated TCP fake listening services (Fake SSH, Fake FTP, Fake HTTP).
 * Traps unauthorized network probes, logs attempted credentials, and fires alerts.
 * 100% isolated: zero shell or command execution logic.
 */

const activeTraps = new Map();
const decoyProbeLogs = [];

/**
 * Banners and responses for fake decoy services
 */
const DECOY_CONFIGS = {
  ssh: {
    type: "ssh",
    defaultPort: 2222,
    banner: "SSH-2.0-OpenSSH_7.2p2 Ubuntu-4ubuntu2.8\r\n",
    prompt: "login as: ",
    rejectMessage: "\r\nAccess denied. Permission denied (publickey,password).\r\n",
    serviceName: "Fake SSH Trap (OpenSSH 7.2p2)",
  },
  ftp: {
    type: "ftp",
    defaultPort: 2121,
    banner: "220 (vsFTPd 2.3.4)\r\n",
    userResponse: "331 Please specify the password.\r\n",
    rejectMessage: "530 Login incorrect.\r\n",
    serviceName: "Fake FTP Trap (vsFTPd 2.3.4)",
  },
  http: {
    type: "http",
    defaultPort: 8080,
    banner: "HTTP/1.1 200 OK\r\nServer: Apache/2.4.7 (Ubuntu)\r\nContent-Type: text/html\r\n\r\n<html><body><h1>PortSentinel Security Gateway</h1><p>Unauthorized access logged.</p></body></html>\r\n",
    serviceName: "Fake HTTP Trap (Apache 2.4.7)",
  },
};

let onProbeDetectedCallback = dispatchDecoyProbeAlert;

export function registerProbeAlertHandler(handlerFn) {
  onProbeDetectedCallback = handlerFn;
}

function recordProbeHit(probeData) {
  const hitEvent = {
    id: `probe-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    sourceIp: probeData.sourceIp || "127.0.0.1",
    sourcePort: probeData.sourcePort || 54321,
    targetPort: probeData.targetPort,
    decoyType: probeData.decoyType,
    serviceName: probeData.serviceName,
    attemptedUser: probeData.attemptedUser || "admin",
    attemptedPass: probeData.attemptedPass || "********",
    rawPayload: probeData.rawPayload || "",
    severity: "HIGH",
    category: "Deception Alert",
    status: "DETECTED",
  };

  decoyProbeLogs.unshift(hitEvent);
  if (decoyProbeLogs.length > 200) decoyProbeLogs.pop();

  logAudit({
    userId: "system",
    action: "DECOY_PROBE_DETECTED",
    target: `${hitEvent.sourceIp}:${hitEvent.targetPort}`,
    details: hitEvent,
  });

  if (typeof onProbeDetectedCallback === "function") {
    try {
      onProbeDetectedCallback(hitEvent);
    } catch (e) {
      console.error("Probe alert callback error:", e.message);
    }
  }

  return hitEvent;
}

export function getActiveDecoyTraps() {
  const list = [];
  for (const [trapId, item] of activeTraps.entries()) {
    list.push({ trapId, ...item.info });
  }
  return list;
}

export function getDecoyProbeLogs() {
  return decoyProbeLogs;
}

export function clearDecoyProbeLogs() {
  decoyProbeLogs.length = 0;
  return { success: true, message: "Decoy probe log feed cleared." };
}

export async function simulateDecoyProbe(probeData = {}) {
  const type = probeData.type || "ssh";
  const config = DECOY_CONFIGS[type] || DECOY_CONFIGS.ssh;
  const targetPort = Number(probeData.port || config.defaultPort);

  return recordProbeHit({
    sourceIp: probeData.sourceIp || "192.168.1.105",
    sourcePort: probeData.sourcePort || Math.floor(Math.random() * 10000) + 50000,
    targetPort,
    decoyType: type,
    serviceName: config.serviceName,
    attemptedUser: probeData.attemptedUser || (type === "ssh" ? "root" : type === "ftp" ? "anonymous" : "admin"),
    attemptedPass: probeData.attemptedPass || (type === "ssh" ? "toor" : type === "ftp" ? "guest@local" : "admin123"),
    rawPayload: "Simulated Probe Hit",
  });
}

/**
 * Starts a fake decoy trap listener
 */
export async function startDecoyTrap({ type = "ssh", port, targetHost = "0.0.0.0", userConsent = false }) {
  if (!userConsent) {
    throw new Error("Explicit user authorization consent is required to deploy live decoy listening traps.");
  }

  const config = DECOY_CONFIGS[type] || DECOY_CONFIGS.ssh;
  const listenPort = Number(port || config.defaultPort);
  const trapId = `trap-${type}-${listenPort}`;

  if (activeTraps.has(trapId)) {
    return { success: true, message: `Decoy trap ${trapId} is already running on port ${listenPort}.`, trap: activeTraps.get(trapId).info };
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      const sourceIp = socket.remoteAddress?.replace(/^.*:/, "") || "127.0.0.1";
      const sourcePort = socket.remotePort || 0;

      let buffer = "";
      let hasLogged = false;

      // Send initial decoy banner immediately
      socket.write(config.banner);

      const logAttempt = (user = "admin", pass = "********") => {
        if (hasLogged) return;
        hasLogged = true;

        recordProbeHit({
          sourceIp,
          sourcePort,
          targetPort: listenPort,
          decoyType: type,
          serviceName: config.serviceName,
          attemptedUser: user,
          attemptedPass: pass,
          rawPayload: buffer.substring(0, 100),
        });
      };

      socket.on("data", (data) => {
        const text = data.toString("utf8");
        buffer += text;

        if (type === "ssh") {
          let user = "admin";
          let pass = "********";

          const userMatch = buffer.match(/(professor[^\s]*|root|admin|mades|user[^\s]*|[a-zA-Z0-9_-]{3,15})/i);
          if (userMatch) user = userMatch[1];
          else if (text.trim().length > 0) user = text.trim().substring(0, 20);

          logAttempt(user, pass);

          try {
            socket.write(config.rejectMessage);
            socket.end();
          } catch (_) {}
        } else if (type === "ftp") {
          if (text.toUpperCase().startsWith("USER ")) {
            const user = text.substring(5).trim();
            socket.write(config.userResponse);
            buffer = `USER:${user};`;
          } else if (text.toUpperCase().startsWith("PASS ")) {
            const pass = text.substring(5).trim();
            const userMatch = buffer.match(/USER:([^;]+);/);
            const user = userMatch ? userMatch[1] : "anonymous";
            logAttempt(user, pass);
            socket.write(config.rejectMessage);
            socket.end();
          } else {
            logAttempt("anonymous", "guest");
            socket.write(config.rejectMessage);
            socket.end();
          }
        } else if (type === "http") {
          logAttempt("http_client", "GET /");
          socket.end();
        }
      });

      socket.on("error", () => {
        // Silently close on socket reset without logging 0-byte noise
      });
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${listenPort} is already in use by another application on your host system.`));
      } else {
        reject(err);
      }
    });

    server.listen(listenPort, targetHost, () => {
      const trapInfo = {
        trapId,
        type,
        port: listenPort,
        serviceName: config.serviceName,
        startedAt: new Date().toISOString(),
        status: "ACTIVE",
      };

      activeTraps.set(trapId, { server, info: trapInfo });
      resolve({ success: true, message: `Decoy trap listening on ${targetHost}:${listenPort}`, trap: trapInfo });
    });
  });
}

export async function stopDecoyTrap(trapId) {
  if (!activeTraps.has(trapId)) {
    return { success: false, message: `Trap ${trapId} is not active.` };
  }

  const { server, info } = activeTraps.get(trapId);
  return new Promise((resolve) => {
    server.close(() => {
      activeTraps.delete(trapId);
      resolve({ success: true, message: `Decoy trap ${info.serviceName} stopped.`, trapId });
    });
  });
}
