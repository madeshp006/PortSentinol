import readline from "node:readline";
import os from "node:os";
import { saveConfig, getConfig } from "./config.js";
import { logger } from "./utils/logger.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

export async function checkAndRegisterAgent() {
  const config = getConfig();

  let serverUrl = config.serverUrl;
  let apiKey = config.apiKey;

  // Non-interactive check (e.g., environment variables)
  const isNonInteractive = Boolean(process.env.PORT_SENTINEL_URL && process.env.PORT_SENTINEL_API_KEY);

  if (!serverUrl || !apiKey) {
    if (isNonInteractive) {
      serverUrl = process.env.PORT_SENTINEL_URL;
      apiKey = process.env.PORT_SENTINEL_API_KEY;
    } else {
      logger.info("Welcome to PortSentinel Local Agent Installation.");
      serverUrl = await question("Enter PortSentinel Backend URL (default: http://localhost:5000): ") || "http://localhost:5000";
      apiKey = await question("Enter your User API Key: ");
      while (!apiKey.trim()) {
        logger.warn("User API Key is required to register the agent.");
        apiKey = await question("Enter your User API Key: ");
      }
    }
    saveConfig({ serverUrl, apiKey });
  }

  if (config.agentId && config.agentKey) {
    logger.info(`Agent already registered: ${config.name} (${config.agentId})`);
    rl.close();
    return true;
  }

  const deviceName = os.hostname();
  const operatingSystem = os.type();
  const version = "1.0.0";
  
  let name = deviceName;
  if (!isNonInteractive) {
    name = await question(`Enter a friendly name for this agent (default: ${deviceName}): `) || deviceName;
  }

  logger.info("Registering agent with PortSentinel backend...");

  try {
    const res = await fetch(`${serverUrl}/api/agents/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name,
        deviceName,
        operatingSystem,
        version,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Registration failed with status ${res.status}`);
    }

    saveConfig({
      agentId: data.agent.agentId,
      agentKey: data.agent.apiKey,
      name: data.agent.name,
    });

    logger.success(`Agent registered successfully! ID: ${data.agent.agentId}`);
    rl.close();
    return true;
  } catch (err) {
    logger.error("Failed to register agent:", err.message);
    rl.close();
    process.exit(1);
  }
}
