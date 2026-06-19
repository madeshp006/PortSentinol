const CURRENT_SCAN_KEY = "portsentinel.currentScanId";

type AnyRecord = Record<string, any>;

const cveCatalog: Record<number, string[]> = {
  21: ["CVE-2021-3618"],
  22: ["CVE-2018-15473"],
  23: ["CVE-2020-10188"],
  80: ["CVE-2021-41773"],
  139: ["CVE-2017-0144"],
  445: ["CVE-2017-0144", "CVE-2020-0796"],
  3306: ["CVE-2021-2307"],
  3389: ["CVE-2019-0708"],
  5432: ["CVE-2018-1058"],
  6379: ["CVE-2022-0543"],
  8080: ["CVE-2020-1938"],
};

const descriptionCatalog: Record<number, string> = {
  21: "FTP service detected. Plaintext authentication should be avoided in favor of SFTP or FTPS.",
  22: "SSH service detected. Verify the exposed version and restrict remote access to trusted sources.",
  23: "Telnet is enabled and exposes credentials in plaintext. This should be removed immediately.",
  80: "HTTP service detected. Redirect traffic to HTTPS and enable HSTS where possible.",
  139: "NetBIOS service detected. Limit exposure to trusted internal networks only.",
  443: "HTTPS service detected. Review certificate settings and supported TLS versions.",
  445: "SMB service detected. Internet exposure can enable credential theft and lateral movement.",
  3306: "MySQL listener detected. Database ports should stay private and require strong authentication.",
  3389: "RDP service detected. Restrict access with VPN, MFA, and source IP filtering.",
  5432: "PostgreSQL listener detected. Keep database ports private and audited.",
  6379: "Redis service detected. It should never be publicly reachable without authentication and network controls.",
  8080: "Alternate HTTP service detected. Confirm admin consoles are not exposed publicly.",
};

function inferDescription(port: number, service = "") {
  return descriptionCatalog[port] || `${service || "Service"} detected on port ${port}. Review exposure and access policy.`;
}

function inferBanner(port: number, service = "", version = "") {
  if (!version || version === "Unknown") return "";
  if (port === 22) return `SSH-2.0-${version.replace(/\s+/g, "_")}`;
  if (port === 21) return `220 (${version})`;
  return `${service} ${version}`.trim();
}

export function normalizePort(port: AnyRecord, index = 0) {
  const number = Number(port.number ?? port.port ?? 0);
  const service = String(port.service ?? "unknown");
  const version = String(port.version ?? "Unknown");
  const protocol = String(port.protocol ?? "tcp").toUpperCase();
  const risk = String(port.risk ?? "low").toLowerCase();

  return {
    ...port,
    id: String(port.id ?? `port-${number || index}`),
    number,
    port: number,
    service,
    version,
    protocol,
    state: String(port.state ?? "open"),
    risk,
    description: String(port.description ?? inferDescription(number, service)),
    banner: port.banner ?? inferBanner(number, service, version),
    cve: Array.isArray(port.cve) ? port.cve : cveCatalog[number] ?? [],
  };
}

export function normalizeMisconfig(misconfig: AnyRecord, index = 0, target = "") {
  const service = String(misconfig.service ?? misconfig.title?.split(" ")[0] ?? "Service");
  const port = Number(misconfig.port ?? misconfig.portNumber ?? 0);
  const fix = String(misconfig.fix ?? misconfig.mitigation ?? "Review service configuration and restrict access.");

  return {
    ...misconfig,
    id: String(misconfig.id ?? `misconfig-${port || index}-${index}`),
    title: String(misconfig.title ?? "Configuration issue"),
    description: String(misconfig.description ?? "Potential exposure detected."),
    port,
    service,
    risk: String(misconfig.risk ?? "medium").toLowerCase(),
    affected: String(misconfig.affected ?? target ?? "Current target"),
    fix,
    mitigation: fix,
  };
}

export function hydrateScan(scan: AnyRecord | null | undefined) {
  if (!scan) return null;

  const target = String(scan.target ?? "");
  const ports = Array.isArray(scan.ports) ? scan.ports.map((p, i) => normalizePort(p, i)) : [];
  const rawMisconfigs = Array.isArray(scan.misconfigs)
    ? scan.misconfigs
    : Array.isArray((scan as AnyRecord).misconfigurationsList)
      ? (scan as AnyRecord).misconfigurationsList
      : [];
  const misconfigs = rawMisconfigs.map((m: AnyRecord, i: number) => normalizeMisconfig(m, i, target));
  const uniqueServices = new Set(ports.map((p) => p.service.toLowerCase())).size;

  return {
    ...scan,
    id: String(scan.id ?? scan._id ?? ""),
    target,
    ports,
    misconfigs,
    openPorts: Number(scan.openPorts ?? ports.length),
    servicesDetected: Number((scan.servicesDetected ?? uniqueServices) || ports.length),
    misconfigurations: Number(scan.misconfigurations ?? misconfigs.length),
    totalPorts: Number(scan.totalPorts ?? ports.length),
    riskScore: Number(scan.riskScore ?? 100),
    progress: Number(scan.progress ?? 0),
    status: String(scan.status ?? "completed"),
    timeline: Array.isArray(scan.timeline) ? scan.timeline : [],
    findings: Array.isArray(scan.findings) ? scan.findings : [],
  };
}

export function rememberCurrentScan(scanOrId: AnyRecord | string | null | undefined) {
  const id = typeof scanOrId === "string" ? scanOrId : scanOrId?.id;
  if (!id || typeof window === "undefined") return;
  window.sessionStorage.setItem(CURRENT_SCAN_KEY, id);
}

export function getRememberedScanId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(CURRENT_SCAN_KEY);
}
