function hashString(input = "") {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const portCatalog = [
  { port: 22, service: "ssh", version: "OpenSSH 9.6", risk: "low", description: "Secure shell service detected." },
  { port: 21, service: "ftp", version: "vsftpd 3.0", risk: "high", description: "FTP is often insecure without TLS." },
  { port: 23, service: "telnet", version: "BusyBox telnetd", risk: "critical", description: "Telnet exposes credentials in plaintext." },
  { port: 25, service: "smtp", version: "Postfix smtpd", risk: "medium", description: "Mail relay should be restricted." },
  { port: 53, service: "dns", version: "BIND 9", risk: "low", description: "DNS service detected." },
  { port: 80, service: "http", version: "nginx 1.25", risk: "medium", description: "HTTP service should redirect to HTTPS." },
  { port: 110, service: "pop3", version: "Dovecot pop3d", risk: "medium", description: "Legacy mail protocol exposed." },
  { port: 139, service: "netbios", version: "Samba nmbd", risk: "high", description: "NetBIOS exposure increases attack surface." },
  { port: 143, service: "imap", version: "Dovecot imapd", risk: "medium", description: "Mail service should enforce TLS." },
  { port: 443, service: "https", version: "nginx 1.25", risk: "low", description: "HTTPS service detected." },
  { port: 445, service: "smb", version: "Samba smbd", risk: "high", description: "SMB should not be exposed publicly." },
  { port: 3306, service: "mysql", version: "MySQL 8", risk: "high", description: "Database port should be restricted to private networks." },
  { port: 3389, service: "rdp", version: "Microsoft Terminal Services", risk: "critical", description: "RDP exposure is a common attack path." },
  { port: 5432, service: "postgresql", version: "PostgreSQL 16", risk: "high", description: "Database listener detected." },
  { port: 6379, service: "redis", version: "Redis 7", risk: "critical", description: "Redis should not be internet-accessible without controls." },
  { port: 8080, service: "http-proxy", version: "Jetty 12", risk: "medium", description: "Alternate web service detected." },
];

function pickPorts(seed, scanType) {
  const size = scanType === "deep" ? 8 : scanType === "custom" ? 6 : 4;
  const selected = [];
  for (let i = 0; i < portCatalog.length && selected.length < size; i += 1) {
    const idx = (seed + i * 7) % portCatalog.length;
    const item = portCatalog[idx];
    if (!selected.find((p) => p.port === item.port)) {
      selected.push(item);
    }
  }
  return selected.sort((a, b) => a.port - b.port);
}

function buildMisconfigs(ports) {
  const misconfigs = [];

  for (const port of ports) {
    if (port.port === 21) {
      misconfigs.push({
        title: "FTP exposed without enforced TLS",
        risk: "high",
        description: "FTP traffic may be transmitted in clear text.",
        mitigation: "Disable FTP or require FTPS/SFTP and firewall access by source IP.",
      });
    }
    if (port.port === 23) {
      misconfigs.push({
        title: "Telnet enabled",
        risk: "critical",
        description: "Telnet provides no transport encryption.",
        mitigation: "Disable Telnet and replace it with SSH.",
      });
    }
    if (port.port === 80) {
      misconfigs.push({
        title: "HTTP available",
        risk: "medium",
        description: "Unencrypted web traffic can expose credentials or cookies.",
        mitigation: "Redirect HTTP to HTTPS and enable HSTS.",
      });
    }
    if (port.port === 3389) {
      misconfigs.push({
        title: "RDP publicly reachable",
        risk: "critical",
        description: "Remote desktop should not be exposed broadly to the internet.",
        mitigation: "Restrict RDP with VPN, MFA, and IP allow-listing.",
      });
    }
    if (port.port === 445 || port.port === 139) {
      misconfigs.push({
        title: "SMB/NetBIOS exposed",
        risk: "high",
        description: "File sharing ports are commonly abused when internet-facing.",
        mitigation: "Limit SMB/NetBIOS to trusted internal networks only.",
      });
    }
    if (port.port === 3306 || port.port === 5432 || port.port === 6379) {
      misconfigs.push({
        title: `${port.service.toUpperCase()} service exposed`,
        risk: port.risk,
        description: "Database and cache ports should usually stay private.",
        mitigation: "Bind the service to a private interface and enforce authentication + network controls.",
      });
    }
  }

  return misconfigs;
}

function durationFor(scanType) {
  if (scanType === "deep") return "18m 42s";
  if (scanType === "custom") return "4m 36s";
  return "1m 58s";
}

function totalPortsFor(scanType, portRange) {
  if (scanType === "deep") return 65535;
  if (scanType === "custom" && portRange?.includes("-")) {
    const [start, end] = portRange.split("-").map((v) => Number(v.trim()));
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return end - start + 1;
    }
  }
  return 1000;
}

export function generateSampleScan({ target, scanType = "quick", portRange = "" }) {
  const seed = hashString(`${target}:${scanType}:${portRange}`);
  const ports = pickPorts(seed, scanType).map((port) => ({
    ...port,
    protocol: "tcp",
    state: "open",
  }));
  const misconfigs = buildMisconfigs(ports);
  const penalties = ports.reduce((sum, port) => {
    if (port.risk === "critical") return sum + 18;
    if (port.risk === "high") return sum + 12;
    if (port.risk === "medium") return sum + 7;
    return sum + 2;
  }, 0) + misconfigs.length * 4;
  const riskScore = Math.max(18, 100 - penalties);

  return {
    target,
    scanType: scanType === "quick" ? "Quick Scan" : scanType === "deep" ? "Deep Scan" : "Custom Scan",
    portRange,
    duration: durationFor(scanType),
    riskScore,
    openPorts: ports.length,
    servicesDetected: ports.length,
    misconfigurations: misconfigs.length,
    totalPorts: totalPortsFor(scanType, portRange),
    ports,
    misconfigs,
    savedAt: new Date(),
    timestamp: new Date(),
  };
}
