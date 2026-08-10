import { getCache, setCache } from "./cveCache.js";

/**
 * Normalizes product name for search queries.
 */
function normalizeProductQuery(product = "") {
  let clean = String(product || "").trim().toLowerCase();
  clean = clean.replace(/^(apache\s+http\s+server|apache\s+httpd)/i, "apache");
  clean = clean.replace(/dropbear\s+ssh/i, "dropbear");
  clean = clean.replace(/microsoft\s+iis/i, "iis");
  return clean;
}

/**
 * Calculates exposure weight based on target network accessibility and port sensitivity.
 */
export function calculateExposureWeight(port = 0, target = "") {
  const SENSITIVE_PORTS = [21, 23, 139, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379];
  const MEDIUM_PORTS = [22, 25, 53, 80, 110, 143, 443, 993, 995, 8080, 8443];

  const targetStr = String(target || "").toLowerCase();
  const isPrivate =
    targetStr === "localhost" ||
    targetStr === "127.0.0.1" ||
    targetStr.startsWith("192.168.") ||
    targetStr.startsWith("10.") ||
    targetStr.startsWith("172.16.") ||
    targetStr.endsWith(".local");

  const networkFactor = isPrivate ? 0.6 : 1.0;

  let portFactor = 0.4;
  const p = Number(port);
  if (SENSITIVE_PORTS.includes(p)) {
    portFactor = 1.0;
  } else if (MEDIUM_PORTS.includes(p)) {
    portFactor = 0.8;
  }

  const weight = Number((networkFactor * portFactor).toFixed(2));
  return Math.min(1.0, Math.max(0.1, weight));
}

/**
 * Maps composite score to Low/Medium/High/Critical severity band.
 */
export function scoreToSeverityBand(compositeScore = 0) {
  if (compositeScore >= 0.70) return "critical";
  if (compositeScore >= 0.45) return "high";
  if (compositeScore >= 0.20) return "medium";
  return "low";
}

/**
 * Maps static risk string to composite numeric fallback score.
 */
function staticRiskToCompositeScore(risk = "low") {
  const r = String(risk).toLowerCase();
  if (r === "critical") return 0.85;
  if (r === "high") return 0.65;
  if (r === "medium") return 0.35;
  return 0.15;
}

/**
 * Stage 1: Fetches known CVEs for a given product and version string using free NVD / CIRCL APIs.
 */
export async function fetchCvesForProduct(product, version) {
  if (!product || product === "Unknown" || !version || version === "Unknown") {
    return [];
  }

  const queryProduct = normalizeProductQuery(product);
  const cacheKey = `cve:${queryProduct}:${version.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const keyword = `${queryProduct} ${version}`;
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: { "User-Agent": "PortSentinel/1.0" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      throw new Error(`CVE API returned status ${res.status}`);
    }

    const data = await res.json();
    const vulnerabilities = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : [];

    const formattedCves = vulnerabilities.slice(0, 10).map((v) => {
      const item = v.cve || {};
      const metrics = item.metrics || {};
      const cvssV3 = metrics.cvssMetricV31?.[0]?.cvssData || metrics.cvssMetricV30?.[0]?.cvssData || {};
      const cvssV2 = metrics.cvssMetricV2?.[0]?.cvssData || {};
      
      const descObj = item.descriptions?.find((d) => d.lang === "en") || item.descriptions?.[0] || {};
      const cvssScore = Number(cvssV3.baseScore || cvssV2.baseScore || 5.0);

      return {
        id: String(item.id || "").toUpperCase(),
        summary: String(descObj.value || "No description available.").slice(0, 300),
        cvss: cvssScore,
        published: item.published ? String(item.published).split("T")[0] : undefined,
      };
    });

    setCache(cacheKey, formattedCves, 7 * 24 * 60 * 60 * 1000);
    return formattedCves;
  } catch (err) {
    console.warn(`[cveScorer] Failed to fetch CVEs for ${product} ${version}:`, err.message);
    return [];
  }
}

/**
 * Stage 2: Fetches EPSS probability scores for an array of CVE IDs from FIRST.org API.
 */
export async function fetchEpssScores(cveIds = []) {
  const uniqueIds = [...new Set(cveIds.filter((id) => id && id.startsWith("CVE-")))];
  if (uniqueIds.length === 0) return {};

  const epssMap = {};
  const missingIds = [];

  for (const id of uniqueIds) {
    const cached = getCache(`epss:${id}`);
    if (cached !== null && cached !== undefined) {
      epssMap[id] = cached;
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) {
    return epssMap;
  }

  try {
    const url = `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(missingIds.join(","))}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      throw new Error(`FIRST.org EPSS API status ${res.status}`);
    }

    const json = await res.json();
    const rows = Array.isArray(json.data) ? json.data : [];

    rows.forEach((row) => {
      if (row.cve && row.epss !== undefined) {
        const prob = parseFloat(row.epss);
        epssMap[row.cve] = prob;
        setCache(`epss:${row.cve}`, prob, 24 * 60 * 60 * 1000);
      }
    });

    missingIds.forEach((id) => {
      if (epssMap[id] === undefined) {
        epssMap[id] = 0.001;
        setCache(`epss:${id}`, 0.001, 24 * 60 * 60 * 1000);
      }
    });
  } catch (err) {
    console.warn(`[cveScorer] EPSS lookup failed for ${missingIds.length} CVEs:`, err.message);
    missingIds.forEach((id) => {
      if (epssMap[id] === undefined) {
        epssMap[id] = 0.001;
      }
    });
  }

  return epssMap;
}

/**
 * Stage 4: Generates specific, CVE-aware remediation guidance.
 */
export function generateDynamicMitigation(finding = {}) {
  const { product, version, port, cve, cveStatus } = finding;

  if (cveStatus === "matched" && Array.isArray(cve) && cve.length > 0) {
    // Sort CVEs by highest EPSS probability, then highest CVSS
    const sorted = [...cve].sort((a, b) => (b.epss || 0) - (a.epss || 0) || (b.cvss || 0) - (a.cvss || 0));
    const topCve = sorted[0];
    const epssPercent = ((topCve.epss || 0) * 100).toFixed(1);

    return `${product} ${version} on port ${port} is affected by ${topCve.id} (EPSS: ${epssPercent}% exploit probability in 30 days, CVSS: ${topCve.cvss}). Upgrade ${product} to a patched release or restrict port ${port} access.`;
  }

  if (product && product !== "Unknown") {
    return `Review ${product} exposure on port ${port}. Restrict access to authorized IPs and verify security patch level.`;
  }

  return `Review port ${port} exposure. Restrict access and verify necessity.`;
}

/**
 * Stage 3 & 4 combined: Evaluates composite risk score, severity band, and dynamic mitigation guidance.
 */
export async function evaluateCompositeRiskScore(finding = {}, target = "") {
  const exposureWeight = calculateExposureWeight(finding.port, target);
  const { product, version } = finding;

  if (!product || product === "Unknown" || !version || version === "Unknown") {
    const fallbackScore = staticRiskToCompositeScore(finding.risk || "low");
    const updatedFinding = {
      ...finding,
      cveStatus: "no_version",
      cve: Array.isArray(finding.cve) ? finding.cve : [],
      risk: scoreToSeverityBand(fallbackScore),
      riskDetails: {
        epssProb: 0,
        cvssBase: 0,
        exposureWeight,
        compositeScore: fallbackScore,
        scoringMethod: "fallback_static",
        note: "fallback scoring used — no software version detected",
      },
    };
    return {
      ...updatedFinding,
      mitigation: generateDynamicMitigation(updatedFinding),
    };
  }

  const matchedCves = await fetchCvesForProduct(product, version);
  if (matchedCves.length === 0) {
    const fallbackScore = staticRiskToCompositeScore(finding.risk || "medium");
    const updatedFinding = {
      ...finding,
      cveStatus: "generic_risk",
      cve: [],
      risk: scoreToSeverityBand(fallbackScore),
      riskDetails: {
        epssProb: 0,
        cvssBase: 0,
        exposureWeight,
        compositeScore: fallbackScore,
        scoringMethod: "fallback_static",
        note: "fallback scoring used — no matching CVEs found",
      },
    };
    return {
      ...updatedFinding,
      mitigation: generateDynamicMitigation(updatedFinding),
    };
  }

  const cveIds = matchedCves.map((c) => c.id);
  const epssScores = await fetchEpssScores(cveIds);

  const cveWithEpss = matchedCves.map((cveObj) => ({
    ...cveObj,
    epss: epssScores[cveObj.id] !== undefined ? epssScores[cveObj.id] : 0.001,
  }));

  const maxEpss = Math.max(...cveWithEpss.map((c) => c.epss));
  const maxCvss = Math.max(...cveWithEpss.map((c) => c.cvss));
  const normalizedCvss = maxCvss / 10.0;

  const compositeScore = Number(
    (0.5 * maxEpss + 0.3 * normalizedCvss + 0.2 * exposureWeight).toFixed(4)
  );

  const calculatedSeverity = scoreToSeverityBand(compositeScore);

  const updatedFinding = {
    ...finding,
    cveStatus: "matched",
    cve: cveWithEpss,
    risk: calculatedSeverity,
    riskDetails: {
      epssProb: maxEpss,
      cvssBase: maxCvss,
      exposureWeight,
      compositeScore,
      scoringMethod: "epss_cvss",
      note: "composite risk score evaluated via EPSS + CVSS + exposure weight",
    },
  };

  return {
    ...updatedFinding,
    mitigation: generateDynamicMitigation(updatedFinding),
  };
}

/**
 * Enriches all scan findings with CVEs, EPSS scores, composite risk scores, and dynamic mitigations.
 */
export async function processFindingsWithEpss(ports = [], target = "") {
  return Promise.all(ports.map((portObj) => evaluateCompositeRiskScore(portObj, target)));
}
