/**
 * Isolated Drift Detection Engine for PortSentinel Scanner.
 * Compares current scan results against the most recent prior scan of the same target.
 */

function formatTimestamp(ts) {
  if (!ts) return "previous scan";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "previous scan";
  }
}

function getCompositeScore(portObj) {
  if (portObj?.riskDetails?.compositeScore !== undefined) {
    return Number(portObj.riskDetails.compositeScore);
  }
  const r = String(portObj?.risk || "low").toLowerCase();
  if (r === "critical") return 0.85;
  if (r === "high") return 0.65;
  if (r === "medium") return 0.35;
  return 0.15;
}

function calculateEventPriority(eventType, risk = "low", prevScore = 0, currScore = 0) {
  const normRisk = String(risk).toLowerCase();

  switch (eventType) {
    case "NEW_OPEN_PORT":
      if (normRisk === "critical" || currScore >= 0.70) return "urgent";
      if (normRisk === "high" || currScore >= 0.45) return "high";
      return "medium";

    case "SERVICE_CHANGED":
      if (currScore > prevScore) return "high";
      return "medium";

    case "RISK_INCREASED":
      if (normRisk === "critical" || currScore >= 0.70) return "urgent";
      return "high";

    case "RISK_DECREASED":
      return "low";

    case "CLOSED_PORT":
      return "info";

    default:
      return "info";
  }
}

/**
 * Compares current scan findings against previous scan findings for the same target.
 * Returns classified list of drift events sorted by priority.
 * 
 * @param {object} currentScan - { target, ports: [], findings: [] }
 * @param {object|null} previousScan - { target, ports: [], findings: [], requestedAt }
 * @returns {Array<object>} Classified drift events
 */
export function detectDrift(currentScan = {}, previousScan = null) {
  if (!previousScan || !Array.isArray(previousScan.ports)) {
    return [];
  }

  const currentPorts = Array.isArray(currentScan.ports) ? currentScan.ports : [];
  const previousPorts = Array.isArray(previousScan.ports) ? previousScan.ports : [];
  const prevDateStr = formatTimestamp(previousScan.requestedAt || previousScan.createdAt);
  const target = currentScan.target || previousScan.target || "target";

  const prevMap = new Map();
  previousPorts.forEach((p) => {
    if (p && p.port) prevMap.set(Number(p.port), p);
  });

  const currMap = new Map();
  currentPorts.forEach((p) => {
    if (p && p.port) currMap.set(Number(p.port), p);
  });

  const events = [];

  // 1. Detect NEW_OPEN_PORT
  currMap.forEach((curr, port) => {
    if (!prevMap.has(port)) {
      const currScore = getCompositeScore(curr);
      const priority = calculateEventPriority("NEW_OPEN_PORT", curr.risk, 0, currScore);
      const infoStr = curr.product && curr.product !== "Unknown"
        ? `${curr.product}${curr.version && curr.version !== "Unknown" ? ` ${curr.version}` : ""}`
        : (curr.service || "service");

      events.push({
        id: `drift-${target}-${port}-new`,
        target,
        port,
        eventType: "NEW_OPEN_PORT",
        priority,
        previousState: null,
        currentState: {
          port,
          service: curr.service || "unknown",
          product: curr.product || "Unknown",
          version: curr.version || "Unknown",
          risk: curr.risk || "medium",
          compositeScore: currScore,
        },
        explanation: `Port ${port} (${infoStr}) was closed/unlisted on your previous scan (${prevDateStr}) and is now OPEN — flagged ${priority.toUpperCase()} priority (${(curr.risk || "medium").toUpperCase()} risk).`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 2. Detect CLOSED_PORT
  prevMap.forEach((prev, port) => {
    if (!currMap.has(port)) {
      const priority = calculateEventPriority("CLOSED_PORT");
      const infoStr = prev.product && prev.product !== "Unknown"
        ? `${prev.product}${prev.version && prev.version !== "Unknown" ? ` ${prev.version}` : ""}`
        : (prev.service || "service");

      events.push({
        id: `drift-${target}-${port}-closed`,
        target,
        port,
        eventType: "CLOSED_PORT",
        priority,
        previousState: {
          port,
          service: prev.service || "unknown",
          product: prev.product || "Unknown",
          version: prev.version || "Unknown",
          risk: prev.risk || "medium",
          compositeScore: getCompositeScore(prev),
        },
        currentState: null,
        explanation: `Port ${port} (${infoStr}) was open on your previous scan (${prevDateStr}) and is now CLOSED.`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 3. Compare ports present in BOTH scans for SERVICE_CHANGED, RISK_INCREASED, RISK_DECREASED
  currMap.forEach((curr, port) => {
    if (prevMap.has(port)) {
      const prev = prevMap.get(port);
      const currScore = getCompositeScore(curr);
      const prevScore = getCompositeScore(prev);

      const currProd = String(curr.product || curr.service || "").trim().toLowerCase();
      const prevProd = String(prev.product || prev.service || "").trim().toLowerCase();
      const currVer = String(curr.version || "").trim().toLowerCase();
      const prevVer = String(prev.version || "").trim().toLowerCase();

      const productOrVersionChanged =
        (currProd !== prevProd && currProd !== "unknown" && prevProd !== "unknown") ||
        (currVer !== prevVer && currVer !== "unknown" && prevVer !== "unknown");

      if (productOrVersionChanged) {
        const priority = calculateEventPriority("SERVICE_CHANGED", curr.risk, prevScore, currScore);
        events.push({
          id: `drift-${target}-${port}-service-changed`,
          target,
          port,
          eventType: "SERVICE_CHANGED",
          priority,
          previousState: {
            port,
            service: prev.service || "unknown",
            product: prev.product || "Unknown",
            version: prev.version || "Unknown",
            risk: prev.risk || "medium",
            compositeScore: prevScore,
          },
          currentState: {
            port,
            service: curr.service || "unknown",
            product: curr.product || "Unknown",
            version: curr.version || "Unknown",
            risk: curr.risk || "medium",
            compositeScore: currScore,
          },
          explanation: `Port ${port} service/version changed from ${prev.product || prev.service} ${prev.version !== "Unknown" ? prev.version : ""} to ${curr.product || curr.service} ${curr.version !== "Unknown" ? curr.version : ""}.`,
          timestamp: new Date().toISOString(),
        });
      } else if (currScore > prevScore + 0.05 || (String(curr.risk).toLowerCase() !== String(prev.risk).toLowerCase() && currScore > prevScore)) {
        // 4. RISK_INCREASED
        const priority = calculateEventPriority("RISK_INCREASED", curr.risk, prevScore, currScore);
        events.push({
          id: `drift-${target}-${port}-risk-increased`,
          target,
          port,
          eventType: "RISK_INCREASED",
          priority,
          previousState: {
            port,
            service: prev.service,
            product: prev.product,
            version: prev.version,
            risk: prev.risk,
            compositeScore: prevScore,
          },
          currentState: {
            port,
            service: curr.service,
            product: curr.product,
            version: curr.version,
            risk: curr.risk,
            compositeScore: currScore,
          },
          explanation: `Port ${port} (${curr.product || curr.service}) composite risk score increased from ${prevScore.toFixed(2)} (${String(prev.risk).toUpperCase()}) to ${currScore.toFixed(2)} (${String(curr.risk).toUpperCase()}).`,
          timestamp: new Date().toISOString(),
        });
      } else if (prevScore > currScore + 0.05) {
        // 5. RISK_DECREASED
        const priority = calculateEventPriority("RISK_DECREASED", curr.risk, prevScore, currScore);
        events.push({
          id: `drift-${target}-${port}-risk-decreased`,
          target,
          port,
          eventType: "RISK_DECREASED",
          priority,
          previousState: {
            port,
            service: prev.service,
            product: prev.product,
            version: prev.version,
            risk: prev.risk,
            compositeScore: prevScore,
          },
          currentState: {
            port,
            service: curr.service,
            product: curr.product,
            version: curr.version,
            risk: curr.risk,
            compositeScore: currScore,
          },
          explanation: `Port ${port} (${curr.product || curr.service}) composite risk score decreased from ${prevScore.toFixed(2)} to ${currScore.toFixed(2)}.`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  // Sort events by priority: urgent > high > medium > low > info
  const priorityMap = { urgent: 5, high: 4, medium: 3, low: 2, info: 1 };
  return events.sort((a, b) => (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0));
}
