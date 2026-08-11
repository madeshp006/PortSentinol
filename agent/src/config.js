import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logger } from "./utils/logger.js";
import "dotenv/config";

const CONFIG_DIR = path.join(os.homedir(), ".portsentinel");
const CONFIG_FILE = path.join(CONFIG_DIR, "agent.json");

let config = {
  serverUrl: process.env.PORT_SENTINEL_URL || "https://portsentinel-backend.onrender.com",
  apiKey: process.env.PORT_SENTINEL_API_KEY || "",
  agentId: "",
  agentKey: "",
  name: "",
};

export function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      config = { ...config, ...data };
    } catch (err) {
      logger.warn("Failed to parse agent config file, using environment defaults.");
    }
  }

  if (process.env.PORT_SENTINEL_URL) {
    config.serverUrl = process.env.PORT_SENTINEL_URL;
  }
  if (process.env.PORT_SENTINEL_API_KEY) {
    config.apiKey = process.env.PORT_SENTINEL_API_KEY;
  }

  if (config.serverUrl) {
    config.serverUrl = config.serverUrl.replace(/\/app.*$/, "").replace(/\/+$/, "");
  }

  return config;
}

export function saveConfig(newConfig) {
  try {
    config = { ...config, ...newConfig };
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (err) {
    logger.error("Failed to save agent config file:", err.message);
    return false;
  }
}

export function getConfig() {
  return config;
}
