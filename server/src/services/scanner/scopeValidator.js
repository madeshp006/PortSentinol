const privatePatterns = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function isIpv4(target) {
  return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(target);
}

function isValidIpv4(ip) {
  const [addr, cidr] = ip.split("/");
  const parts = addr.split(".").map(Number);
  if (parts.length !== 4) return false;
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
  if (cidr !== undefined) {
    const prefix = Number(cidr);
    if (!Number.isInteger(prefix) || prefix < 8 || prefix > 32) return false;
  }
  return true;
}

export function isPrivateTarget(target = "") {
  const t = String(target || "").trim().toLowerCase();
  if (t === "localhost" || t === "127.0.0.1") {
    return true;
  }
  if (t.endsWith(".local")) {
    return true;
  }
  if (isIpv4(t)) {
    const [addr] = t.split("/");
    return privatePatterns.some((pattern) => pattern.test(addr));
  }
  return false;
}

export function validateAuthorizedTarget(rawTarget = "") {
  const target = String(rawTarget || "").trim().toLowerCase();
  if (!target) {
    return { allowed: false, reason: "Target is required", scopeStatus: "blocked" };
  }

  const isPrivate = isPrivateTarget(target);

  if (target === "localhost" || target === "127.0.0.1") {
    return { allowed: true, scopeStatus: "allowed", normalizedTarget: "127.0.0.1", isPrivate: true };
  }

  if (isIpv4(target)) {
    if (!isValidIpv4(target)) {
      return { allowed: false, reason: "Invalid IPv4 target", scopeStatus: "blocked" };
    }
    return { allowed: true, scopeStatus: "allowed", normalizedTarget: target, isPrivate };
  }

  if (target.endsWith(".local")) {
    return { allowed: true, scopeStatus: "allowed", normalizedTarget: target, isPrivate: true };
  }

  const isDomain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(target);
  if (isDomain) {
    return { allowed: true, scopeStatus: "allowed", normalizedTarget: target, isPrivate: false };
  }

  return {
    allowed: false,
    reason: "Invalid target. Must be a valid IP address, CIDR range, localhost, .local host, or domain name.",
    scopeStatus: "blocked",
  };
}
