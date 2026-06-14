import os from "node:os";
import { getConfig } from "./config.js";
import { logger } from "./utils/logger.js";

export function startHeartbeatLoop() {
  const config = getConfig();

  const sendHeartbeat = async () => {
    try {
      const res = await fetch(`${config.serverUrl}/api/agents/${config.agentId}/heartbeat`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-agent-key": config.agentKey,
        },
        body: JSON.stringify({
          deviceName: os.hostname(),
          operatingSystem: os.type(),
          version: "1.0.0",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        logger.warn(`Heartbeat rejected by backend: ${data.error || res.status}`);
      } else {
        logger.info("Heartbeat sent successfully.");
      }
    } catch (err) {
      logger.error("Heartbeat request failed:", err.message);
    }
  };

  sendHeartbeat();
  setInterval(sendHeartbeat, 60000);
}
