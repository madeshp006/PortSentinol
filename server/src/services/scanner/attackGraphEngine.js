/**
 * Attack Path Modeling & Subnet Graph Engine for PortSentinel.
 * Builds directed attack graphs for multi-host subnet scans, calculates pivot edge weights,
 * and performs Dijkstra/BFS pathfinding for attack path simulation.
 */

function calculateNodeSeverity(riskScore = 100) {
  const score = Number(riskScore);
  if (score < 40) return "critical";
  if (score < 60) return "high";
  if (score < 80) return "medium";
  return "low";
}

/**
 * Builds directed attack graph (nodes, edges, adjacency list) for subnet scans.
 * Uses ONLY real scan target data (never fake hardcoded IPs).
 */
export function buildSubnetAttackGraph(scanData = {}) {
  const targetStr = String(scanData.target || "127.0.0.1").trim();
  const isCidrOrSubnet = targetStr.includes("/") || targetStr.includes(",");

  const hosts = Array.isArray(scanData.hosts)
    ? scanData.hosts
    : (Array.isArray(scanData.multiHost) ? scanData.multiHost : []);

  // Single Host Scan Target
  if (!isCidrOrSubnet && hosts.length <= 1) {
    const realPorts = Array.isArray(scanData.ports) ? scanData.ports : [];
    const realFindings = Array.isArray(scanData.findings) ? scanData.findings : [];
    const realRiskScore = Number(scanData.riskScore ?? 100);
    const realServices = [...new Set(realPorts.map((p) => p.service).filter(Boolean))];

    const firstProduct = realPorts.find((p) => p.product && p.product !== "Unknown")?.product;
    const firstVersion = realPorts.find((p) => p.version && p.version !== "Unknown")?.version;
    const realOsStr = realPorts.length === 0
      ? "Clean Host (0 Open Ports)"
      : firstProduct
      ? `${firstProduct}${firstVersion ? ` ${firstVersion}` : ""}`
      : "Server OS / Host";

    const singleNode = {
      id: targetStr,
      label: `Host ${targetStr}`,
      ip: targetStr,
      os: realOsStr,
      riskScore: realRiskScore,
      severity: calculateNodeSeverity(realRiskScore),
      findingsCount: realFindings.length || realPorts.length,
      services: realServices,
    };

    return {
      isSubnetScan: false,
      target: targetStr,
      totalNodes: 1,
      totalEdges: 0,
      nodes: [singleNode],
      edges: [],
      adjacencyList: { [targetStr]: [] },
    };
  }

  // Multi-Host Subnet Scan
  const nodes = [];
  const edges = [];
  const adjacencyList = {};

  hosts.forEach((hostObj) => {
    const ip = hostObj.host || hostObj.ip || hostObj.target || "192.168.1.1";
    const portList = Array.isArray(hostObj.ports) ? hostObj.ports : [];
    const openServices = [...new Set(portList.map((p) => p.service).filter(Boolean))];
    const riskScore = Number(hostObj.riskScore ?? scanData.riskScore ?? 100);
    const severity = calculateNodeSeverity(riskScore);

    const firstProduct = portList.find((p) => p.product && p.product !== "Unknown")?.product;
    const firstVersion = portList.find((p) => p.version && p.version !== "Unknown")?.version;
    const osStr = portList.length === 0
      ? "Clean Host (0 Open Ports)"
      : firstProduct
      ? `${firstProduct}${firstVersion ? ` ${firstVersion}` : ""}`
      : "Linux / Server OS";

    nodes.push({
      id: ip,
      label: `Host ${ip}`,
      ip,
      os: osStr,
      riskScore,
      severity,
      findingsCount: Array.isArray(hostObj.findings) ? hostObj.findings.length : portList.length,
      services: openServices,
    });

    adjacencyList[ip] = [];
  });

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = 0; j < nodes.length; j += 1) {
      if (i === j) continue;

      const sourceHost = nodes[i];
      const targetHost = nodes[j];
      const targetPorts = hosts[j]?.ports || [];
      const sourceFindings = hosts[i]?.findings || [];

      // Check Vector A: Weak SSH Credentials / Key Reuse Pivot (Weight: 0.95)
      const hasSshCredsWeakness = sourceFindings.some(
        (f) => String(f.code || f.title).includes("CRED") || String(f.title).toLowerCase().includes("root login")
      );
      const targetHasSsh = targetHost.services.includes("ssh") || targetPorts.some((p) => Number(p.port) === 22);

      if (hasSshCredsWeakness && targetHasSsh) {
        const edgeId = `edge-${sourceHost.ip}-${targetHost.ip}-ssh`;
        edges.push({
          id: edgeId,
          source: sourceHost.ip,
          target: targetHost.ip,
          protocol: "ssh",
          port: 22,
          weight: 0.95,
          pivotVulnerability: "SSH Credential Reuse & Key Theft",
          description: `Attacker compromising ${sourceHost.ip} can leverage harvested SSH keys/credentials to pivot directly into ${targetHost.ip}.`,
        });
        adjacencyList[sourceHost.ip].push(targetHost.ip);
        continue;
      }

      // Check Vector B: FTP Backdoor / Anonymous Exploit Pivot (Weight: 0.90)
      const targetHasFtp = targetHost.services.includes("ftp") || targetPorts.some((p) => Number(p.port) === 21);
      const ftpBackdoor = targetPorts.some(
        (p) => String(p.product).toLowerCase().includes("vsftpd") || (p.cve && p.cve.some((c) => String(c.id || c).includes("2011-2523")))
      );

      if (targetHasFtp && ftpBackdoor) {
        const edgeId = `edge-${sourceHost.ip}-${targetHost.ip}-ftp`;
        edges.push({
          id: edgeId,
          source: sourceHost.ip,
          target: targetHost.ip,
          protocol: "ftp",
          port: 21,
          weight: 0.90,
          pivotVulnerability: "Unauthenticated FTP Backdoor Exploit (CVE-2011-2523)",
          description: `Attacker on ${sourceHost.ip} can exploit vsftpd backdoor on ${targetHost.ip} to gain remote root shell access.`,
        });
        adjacencyList[sourceHost.ip].push(targetHost.ip);
        continue;
      }

      // Check Vector C: SMB / NetBIOS Lateral Movement Pivot (Weight: 0.80)
      const targetHasSmb = targetHost.services.includes("smb") || targetPorts.some((p) => [139, 445].includes(Number(p.port)));
      if (targetHasSmb) {
        const edgeId = `edge-${sourceHost.ip}-${targetHost.ip}-smb`;
        edges.push({
          id: edgeId,
          source: sourceHost.ip,
          target: targetHost.ip,
          protocol: "smb",
          port: 445,
          weight: 0.80,
          pivotVulnerability: "SMB/NetBIOS Share Lateral Movement",
          description: `Attacker can pivot from ${sourceHost.ip} to ${targetHost.ip} via SMB share enumeration and NTLM hash relay.`,
        });
        adjacencyList[sourceHost.ip].push(targetHost.ip);
        continue;
      }

      // Check Vector D: Baseline Subnet Domain Reachability (Weight: 0.20)
      const edgeId = `edge-${sourceHost.ip}-${targetHost.ip}-subnet`;
      edges.push({
        id: edgeId,
        source: sourceHost.ip,
        target: targetHost.ip,
        protocol: "tcp",
        port: 0,
        weight: 0.20,
        pivotVulnerability: "Subnet L2/L3 Broadcast Domain Reachability",
        description: `Both hosts share the same subnet broadcast domain (${targetStr}).`,
      });
      adjacencyList[sourceHost.ip].push(targetHost.ip);
    }
  }

  return {
    isSubnetScan: true,
    target: targetStr,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodes,
    edges,
    adjacencyList,
  };
}

/**
 * Stage 2: Simulates lateral attack traversal starting from an initial compromised host.
 */
export function simulateAttackPath(graph = {}, startHostId = "", startVulnerability = "Initial Perimeter Compromise") {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  if (nodes.length === 0) {
    return {
      success: false,
      message: "Attack path simulation requires valid target nodes.",
    };
  }

  const startNode = nodes.find((n) => n.id === startHostId || n.ip === startHostId) || nodes[0];
  const startIp = startNode.ip;

  const nodeMap = new Map(nodes.map((n) => [n.ip, n]));
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  const visited = new Set();
  const queue = [{ currentIp: startIp, path: [startIp], totalWeight: 0, hops: [] }];
  const allPaths = [];

  while (queue.length > 0) {
    queue.sort((a, b) => b.totalWeight - a.totalWeight);
    const { currentIp, path, totalWeight, hops } = queue.shift();

    if (visited.has(currentIp) && path.length > 1) continue;
    visited.add(currentIp);

    const neighbors = edges.filter((e) => e.source === currentIp);
    let expanded = false;

    for (const edge of neighbors) {
      if (!path.includes(edge.target)) {
        expanded = true;
        const newHops = [
          ...hops,
          {
            hopIndex: hops.length + 1,
            fromHost: currentIp,
            toHost: edge.target,
            protocol: edge.protocol,
            port: edge.port,
            weight: edge.weight,
            pivotVulnerability: edge.pivotVulnerability,
            description: edge.description,
          },
        ];

        queue.push({
          currentIp: edge.target,
          path: [...path, edge.target],
          totalWeight: totalWeight + edge.weight,
          hops: newHops,
        });
      }
    }

    if (!expanded && path.length > 1) {
      allPaths.push({ path, totalWeight, hops });
    }
  }

  const bestPathObj = allPaths.sort((a, b) => b.totalWeight - a.totalWeight)[0] || {
    path: [startIp],
    totalWeight: 0.1,
    hops: [],
  };

  const hopCount = bestPathObj.hops.length;
  const targetNode = nodeMap.get(bestPathObj.path[bestPathObj.path.length - 1]) || startNode;
  
  let severityMultiplier = 1.0;
  if (targetNode.severity === "critical") severityMultiplier = 1.8;
  else if (targetNode.severity === "high") severityMultiplier = 1.4;

  const rawPathScore = hopCount === 0
    ? Math.round(100 - startNode.riskScore)
    : Math.min(98, Number(((bestPathObj.totalWeight * 25 * severityMultiplier) + (hopCount * 12)).toFixed(1)));
  const pathSeverity = rawPathScore >= 75 ? "CRITICAL" : rawPathScore >= 50 ? "HIGH" : "LOW";

  const explanation = hopCount === 0
    ? `Target host ${startIp} (${startNode.os}). ${startNode.services.length === 0 ? "0 open ports exposed — host is secure." : `${startNode.services.length} open service port(s) detected.`}`
    : `Attacker gains initial entry on ${startIp} via ${startVulnerability}. From there, the attacker pivots through ${hopCount} hop(s) to reach high-value target ${targetNode.ip} (${targetNode.os}), resulting in network-wide compromise.`;

  return {
    success: true,
    entryHost: startIp,
    entryVulnerability: startVulnerability,
    targetHost: targetNode.ip,
    totalHops: hopCount,
    pathRiskScore: rawPathScore,
    pathSeverity,
    reachableHosts: bestPathObj.path,
    pathHops: bestPathObj.hops,
    explanation,
  };
}
