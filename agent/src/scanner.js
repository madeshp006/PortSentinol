import dns from "node:dns/promises";
import net from "node:net";
import { logger } from "./utils/logger.js";

const COMMON_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 139, 143, 443, 445, 993, 995, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443,
];

const WELL_KNOWN_SERVICES = {
  21: "ftp",
  22: "ssh",
  23: "telnet",
  25: "smtp",
  53: "dns",
  80: "http",
  110: "pop3",
  139: "netbios",
  143: "imap",
  443: "https",
  445: "smb",
  993: "imaps",
  995: "pop3s",
  1433: "mssql",
  1521: "oracle",
  3306: "mysql",
  3389: "rdp",
  5432: "postgresql",
  5900: "vnc",
  6379: "redis",
  8080: "http-alt",
  8443: "https-alt",
};

const RISK_BY_PORT = {
  21: "high",
  22: "medium",
  23: "critical",
  25: "medium",
  53: "low",
  80: "medium",
  139: "high",
  443: "low",
  445: "high",
  1433: "high",
  1521: "high",
  3306: "high",
  3389: "high",
  5432: "high",
  5900: "medium",
  6379: "high",
  8080: "medium",
  8443: "medium",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeScanType(scanType = "quick") {
  const normalized = String(scanType || "").toLowerCase();
  if (normalized.includes("deep")) return "deep";
  if (normalized.includes("custom")) return "custom";
  return "quick";
}

function expandRange(start, end) {
  const ports = [];
  for (let port = start; port <= end; port += 1) {
    ports.push(port);
  }
  return ports;
}

function dedupeSorted(values) {
  return [...new Set(values)]
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 65535)
    .sort((a, b) => a - b);
}

function parsePortRange(scanType, portRange = "") {
  const normalizedType = normalizeScanType(scanType);
  if (normalizedType === "quick") return [...COMMON_PORTS];

  if (normalizedType === "deep") {
    return expandRange(1, 1024);
  }

  const raw = String(portRange || "").trim();
  if (!raw) return [...COMMON_PORTS];

  const collected = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-").map((value) => Number(value.trim()));
      if (!Number.isInteger(startRaw) || !Number.isInteger(endRaw) || startRaw < 1 || endRaw > 4096 || endRaw < startRaw) {
        continue;
      }
      collected.push(...expandRange(startRaw, endRaw));
      continue;
    }

    const port = Number(trimmed);
    if (Number.isInteger(port) && port >= 1 && port <= 65535) {
      collected.push(port);
    }
  }

  return dedupeSorted(collected.length ? collected : COMMON_PORTS);
}

async function resolveTarget(target) {
  try {
    const result = await dns.lookup(target);
    return result.address || target;
  } catch {
    return target;
  }
}

function guessService(port) {
  return WELL_KNOWN_SERVICES[port] || `tcp/${port}`;
}

function guessRisk(port) {
  return RISK_BY_PORT[port] || "low";
}

function portDescription(port, service) {
  const risk = guessRisk(port);
  if (risk === "critical") return `${service} is reachable and should be removed or isolated immediately.`;
  if (risk === "high") return `${service} is reachable on a sensitive port. Restrict access and verify necessity.`;
  if (risk === "medium") return `${service} is reachable. Review exposure and hardening controls.`;
  return `${service} is reachable. Confirm this exposure matches your intended configuration.`;
}

function scanSingleTcpPort(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ open: true }));
    socket.once("timeout", () => finish({ open: false }));
    socket.once("error", () => finish({ open: false }));

    try {
      socket.connect(port, host);
    } catch {
      finish({ open: false });
    }
  });
}

async function scanPortsWithConcurrency({ host, ports, concurrency = 64 }) {
  const openPorts = [];
  let completed = 0;

  async function worker(workerPorts) {
    for (const port of workerPorts) {
      const result = await scanSingleTcpPort(host, port);
      completed += 1;

      if (result.open) {
        const service = guessService(port);
        openPorts.push({
          port,
          service,
          version: "",
          state: "open",
          protocol: "tcp",
          risk: guessRisk(port),
          description: portDescription(port, service),
          banner: "",
          cve: [],
        });
      }
    }
  }

  const buckets = Array.from({ length: Math.min(concurrency, ports.length) }, () => []);
  ports.forEach((port, index) => {
    buckets[index % buckets.length].push(port);
  });

  await Promise.all(buckets.map((bucket) => worker(bucket)));
  return openPorts.sort((a, b) => a.port - b.port);
}

export async function executeScan({ target, scanType, portRange }) {
  const normalizedType = normalizeScanType(scanType);
  const portsToScan = parsePortRange(normalizedType, portRange);
  const startedAt = Date.now();

  logger.info(`Starting execution of job against target: ${target}`);
  const host = await resolveTarget(target);
  logger.info(`Resolved ${target} to ${host}`);

  await sleep(150);

  const openPorts = await scanPortsWithConcurrency({
    host,
    ports: portsToScan,
    concurrency: normalizedType === "deep" ? 96 : 48,
  });

  const durationMs = Date.now() - startedAt;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.max(1, Math.round((durationMs % 60000) / 1000));

  logger.success(`Scan complete for target ${target}. Found ${openPorts.length} open ports.`);

  return {
    target,
    host,
    scanType: normalizedType,
    portRange,
    duration: `${minutes}m ${String(seconds).padStart(2, "0")}s`,
    totalPorts: portsToScan.length,
    openPorts: openPorts.length,
    servicesDetected: new Set(openPorts.map((port) => port.service)).size,
    misconfigurations: 0,
    ports: openPorts,
    misconfigs: [],
    workerMode: "agent",
  };
}
