function scorePenaltyForRisk(risk = "low") {
  const normalized = String(risk).toLowerCase();
  if (normalized === "critical") return 18;
  if (normalized === "high") return 12;
  if (normalized === "medium") return 7;
  return 2;
}

const mitigationCatalog = {
  21: "Disable FTP or move to SFTP/FTPS. Restrict management access by source IP.",
  22: "Restrict SSH to trusted administrators, require key-based auth, and rotate credentials.",
  23: "Disable Telnet and replace it with SSH immediately.",
  80: "Redirect HTTP to HTTPS and enable HSTS.",
  139: "Restrict NetBIOS to trusted internal segments only.",
  445: "Restrict SMB to internal segments only and review patch level.",
  3306: "Bind database listeners to private interfaces and enforce authentication.",
  3389: "Protect RDP behind VPN, MFA, and an allow-list.",
  5432: "Restrict PostgreSQL access to private networks and review authentication policy.",
  6379: "Keep Redis private, enable authentication, and disable dangerous commands.",
  8080: "Review alternate HTTP services for exposed admin panels or debug endpoints.",
};

function defaultMitigationForPort(port, service = "service") {
  return mitigationCatalog[port] || `Review ${service} exposure, restrict access, and verify patch level.`;
}

export function deriveMisconfigs(ports = [], existingMisconfigs = [], target = "") {
  if (Array.isArray(existingMisconfigs) && existingMisconfigs.length > 0) {
    return existingMisconfigs.map((item) => ({
      ...item,
      service: item.service || item.title?.split(" ")[0] || "service",
      port: item.port || 0,
      affected: item.affected || target,
      fix: item.fix || item.mitigation || "Review service configuration and restrict access.",
      mitigation: item.mitigation || item.fix || "Review service configuration and restrict access.",
    }));
  }

  return ports
    .filter((port) => ["critical", "high", "medium"].includes(String(port.risk || "").toLowerCase()))
    .map((port) => ({
      title: `${String(port.service || "Service").toUpperCase()} exposure detected`,
      risk: String(port.risk || "medium").toLowerCase(),
      description: port.description || `${port.service || "Service"} is exposed on port ${port.port}. Review access policy and patch level.`,
      mitigation: defaultMitigationForPort(Number(port.port), port.service),
      service: port.service || "service",
      port: Number(port.port || 0),
      affected: target,
      fix: defaultMitigationForPort(Number(port.port || 0), port.service),
    }));
}

export function deriveFindings(ports = [], misconfigs = []) {
  const findings = [];

  for (const port of ports) {
    const risk = String(port.risk || "low").toLowerCase();
    if (!["critical", "high", "medium"].includes(risk)) continue;
    findings.push({
      code: `PORT-${port.port}`,
      title: `${String(port.service || "Service").toUpperCase()} exposed on ${port.port}/${String(port.protocol || "tcp")}`,
      severity: risk,
      description: port.description || `${port.service || "Service"} was detected as open.`,
      recommendation: defaultMitigationForPort(Number(port.port || 0), port.service),
      port: Number(port.port || 0),
      service: port.service || "service",
    });
  }

  for (const misconfig of misconfigs) {
    findings.push({
      code: `MISCONFIG-${String(misconfig.port || 0)}-${String(misconfig.title || "issue").replace(/\s+/g, "-").toUpperCase()}`,
      title: misconfig.title,
      severity: String(misconfig.risk || "medium").toLowerCase(),
      description: misconfig.description,
      recommendation: misconfig.mitigation || misconfig.fix || "Review service configuration.",
      port: Number(misconfig.port || 0),
      service: misconfig.service || "service",
    });
  }

  return findings;
}

export function computeRiskScore(ports = [], misconfigs = []) {
  const penalties = ports.reduce((sum, port) => sum + scorePenaltyForRisk(port.risk), 0)
    + misconfigs.length * 4;
  return Math.max(18, 100 - penalties);
}

export function summarizeScan(result = {}) {
  const ports = Array.isArray(result.ports) ? result.ports : [];
  const misconfigs = deriveMisconfigs(ports, result.misconfigs, result.target || "");
  const findings = deriveFindings(ports, misconfigs);
  const uniqueServices = new Set(ports.map((port) => String(port.service || "unknown").toLowerCase())).size;
  const riskScore = Number.isFinite(Number(result.riskScore)) ? Number(result.riskScore) : computeRiskScore(ports, misconfigs);

  return {
    duration: result.duration || "1m 58s",
    riskScore,
    openPorts: Number.isFinite(Number(result.openPorts)) ? Number(result.openPorts) : ports.length,
    servicesDetected: Number.isFinite(Number(result.servicesDetected)) ? Number(result.servicesDetected) : uniqueServices,
    misconfigurations: Number.isFinite(Number(result.misconfigurations)) ? Number(result.misconfigurations) : misconfigs.length,
    totalPorts: Number.isFinite(Number(result.totalPorts)) ? Number(result.totalPorts) : ports.length,
    ports,
    misconfigs,
    findings,
  };
}
