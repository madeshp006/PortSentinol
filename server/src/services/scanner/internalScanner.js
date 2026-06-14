import dns from "node:dns/promises";
import net from "node:net";

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

async function scanPortsWithConcurrency({ host, ports, concurrency = 64, onProgress }) {
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

      if (onProgress && (completed === ports.length || completed % Math.max(1, Math.floor(ports.length / 10)) === 0)) {
        const progress = 20 + Math.round((completed / ports.length) * 65);
        await onProgress({
          progress,
          stage: "enumeration",
          msg: `Scanned ${completed}/${ports.length} ports on ${host}`,
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

async function runLocalTcpScan({ target, scanType, portRange, onProgress }) {
  const normalizedType = normalizeScanType(scanType);
  const portsToScan = parsePortRange(normalizedType, portRange);
  const startedAt = Date.now();

  if (onProgress) {
    await onProgress({ progress: 6, stage: "queued", msg: "Local scan worker accepted the job" });
  }

  const host = await resolveTarget(target);

  if (onProgress) {
    await onProgress({ progress: 12, stage: "discovery", msg: `Resolved ${target} to ${host}` });
  }

  await sleep(150);

  if (onProgress) {
    await onProgress({ progress: 18, stage: "discovery", msg: `Preparing TCP checks for ${portsToScan.length} ports` });
  }

  const openPorts = await scanPortsWithConcurrency({
    host,
    ports: portsToScan,
    concurrency: normalizedType === "deep" ? 96 : 48,
    onProgress,
  });

  if (onProgress) {
    await onProgress({ progress: 92, stage: "analysis", msg: "Analyzing exposed services and generating findings" });
  }

  const durationMs = Date.now() - startedAt;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.max(1, Math.round((durationMs % 60000) / 1000));

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
    workerMode: "local",
  };
}

async function runAgentScan({ target, scanType, portRange, onProgress }) {
  const endpoint = process.env.INTERNAL_SCANNER_ENDPOINT;
  if (!endpoint) {
    throw new Error("INTERNAL_SCANNER_ENDPOINT is not configured");
  }

  if (onProgress) {
    await onProgress({ progress: 12, stage: "queued", msg: "Dispatching scan to approved internal scanner agent" });
  }

  const headers = {
    "Content-Type": "application/json",
  };
  if (process.env.INTERNAL_SCANNER_API_KEY) {
    headers["x-api-key"] = process.env.INTERNAL_SCANNER_API_KEY;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ target, scanType, portRange }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Internal scanner error ${res.status}`);
  }

  if (onProgress) {
    await onProgress({ progress: 72, stage: "analysis", msg: "Internal scanner completed, processing results" });
  }

  const result = data.result || data;
  return {
    ...result,
    target: result.target || target,
    scanType: result.scanType || scanType,
    portRange: result.portRange || portRange,
    workerMode: "agent",
  };
}

export async function runInternalScannerJob(params) {
  const mode = String(process.env.INTERNAL_SCANNER_MODE || "local").toLowerCase();
  const shouldUseAgent = Boolean(process.env.INTERNAL_SCANNER_ENDPOINT) && mode === "agent";
  if (shouldUseAgent) {
    return runAgentScan(params);
  }
  return runLocalTcpScan(params);
}

export function estimateTotalPorts(scanType, portRange = "") {
  return parsePortRange(scanType, portRange).length;
}
