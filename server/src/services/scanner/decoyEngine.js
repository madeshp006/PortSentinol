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

/**
 * Callbacks for probe alerts (attached in Stage 2)
 */
let onProbeDetectedCallback = dispatchDecoyProbeAlert;

export function registerProbeAlertHandler(handlerFn) {
  onProbeDetectedCallback = handlerFn;
}

/**
 * Records a probe event and triggers alert callback
 */

function recordProbeHit(probeData) {
  const hitEvent = {
    id: `probe-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    sourceIp: probeData.sourceIp || "192.168.1.100",
    sourcePort: probeData.sourcePort || 54321,
    targetPort: probeData.targetPort,
    decoyType: probeData.decoyType,
    serviceName: probeData.serviceName,
    attemptedUser: probeData.attemptedUser || "anonymous",
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
      let attemptedUser = "";
      let attemptedPass = "";

      // Send initial decoy banner immediately
      socket.write(config.banner);

      socket.on("data", (data) => {
        const text = data.toString("utf8");
        buffer += text;

        if (type === "ssh") {
          // Parse fake SSH username / password strings from buffer
          const lines = buffer.split(/[\r\n]+/);
          if (lines.length > 0 && lines[0] && !attemptedUser) {
            attemptedUser = lines[0].trim();
            socket.write(`Password for ${attemptedUser}: `);
          } else if (lines.length > 1 && !attemptedPass) {
            attemptedPass = lines[1].trim();
            socket.write(config.rejectMessage);

            recordProbeHit({
              sourceIp,
              sourcePort,
              targetPort: listenPort,
              decoyType: type,
              serviceName: config.serviceName,
              attemptedUser: attemptedUser || "admin",
              attemptedPass: attemptedPass || "admin123",
              rawPayload: buffer.substring(0, 100),
            });

            socket.end();
          }
        } else if (type === "ftp") {
          if (text.toUpperCase().startsWith("USER ")) {
            attemptedUser = text.substring(5).trim();
            socket.write(config.userResponse);
          } else if (text.toUpperCase().startsWith("PASS ")) {
            attemptedPass = text.substring(5).trim();
            socket.write(config.rejectMessage);

            recordProbeHit({
              sourceIp,
              sourcePort,
              targetPort: listenPort,
              decoyType: type,
              serviceName: config.serviceName,
              attemptedUser: attemptedUser || "anonymous",
              attemptedPass: attemptedPass || "guest",
              rawPayload: buffer.substring(0, 100),
            });

            socket.end();
          }
        } else {
          // HTTP Decoy
          recordProbeHit({
            sourceIp,
            sourcePort,
            targetPort: listenPort,
            decoyType: type,
            serviceName: config.serviceName,
            attemptedUser: "http-probe",
            attemptedPass: "N/A",
            rawPayload: buffer.substring(0, 100),
          });
          socket.end();
        }
      });

      socket.on("error", () => {
        socket.destroy();
      });
    });

    server.on("error", (err) => {
      reject(new Error(`Failed to start ${config.serviceName} on port ${listenPort}: ${err.message}`));
    });

    server.listen(listenPort, targetHost, () => {
      const trapInfo = {
        trapId,
        type,
        port: listenPort,
        serviceName: config.serviceName,
        targetHost,
        startedAt: new Date().toISOString(),
        status: "ACTIVE",
      };

      activeTraps.set(trapId, { server, info: trapInfo });
      console.log(`[DECOY ENGINE] Started ${config.serviceName} listening on port ${listenPort}`);
      resolve({ success: true, message: `Deployed ${config.serviceName} listening on port ${listenPort}`, trap: trapInfo });
    });
  });
}

/**
 * Stops an active decoy trap
 */
export async function stopDecoyTrap(trapId) {
  if (!activeTraps.has(trapId)) {
    return { success: false, message: `Decoy trap ${trapId} is not active.` };
  }

  const { server, info } = activeTraps.get(trapId);
  return new Promise((resolve) => {
    server.close(() => {
      activeTraps.delete(trapId);
      console.log(`[DECOY ENGINE] Stopped decoy trap ${trapId}`);
      resolve({ success: true, message: `Stopped decoy trap ${info.serviceName} on port ${info.port}` });
    });
  });
}

/**
 * Returns list of active decoy traps
 */
export function getActiveDecoyTraps() {
  return Array.from(activeTraps.values()).map((t) => t.info);
}

/**
 * Returns decoy probe logs
 */
export function getDecoyProbeLogs() {
  return [...decoyProbeLogs];
}

/**
 * Simulates a probe hit for live presentation demos
 */
export function simulateDecoyProbe({ type = "ssh", port = 2222, sourceIp = "192.168.1.105", attemptedUser = "root", attemptedPass = "toor" }) {
  const config = DECOY_CONFIGS[type] || DECOY_CONFIGS.ssh;
  return recordProbeHit({
    sourceIp,
    sourcePort: Math.floor(Math.random() * 20000) + 40000,
    targetPort: Number(port),
    decoyType: type,
    serviceName: config.serviceName,
    attemptedUser,
    attemptedPass,
    rawPayload: `Simulated probe test on ${type} port ${port}`,
  });
}
