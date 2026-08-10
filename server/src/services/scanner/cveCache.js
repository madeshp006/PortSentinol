import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store cache file in server/data/cve_cache.json
const DATA_DIR = path.resolve(__dirname, "../../../data");
const CACHE_FILE = path.join(DATA_DIR, "cve_cache.json");

let memoryCache = null;

function ensureCacheLoaded() {
  if (memoryCache !== null) return memoryCache;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf8");
      memoryCache = JSON.parse(raw || "{}");
    } else {
      memoryCache = {};
    }
  } catch (err) {
    console.warn("[cveCache] Failed to load cache file, using in-memory store:", err.message);
    memoryCache = {};
  }
  return memoryCache;
}

function persistCache() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2), "utf8");
  } catch (err) {
    console.warn("[cveCache] Failed to persist cache file:", err.message);
  }
}

/**
 * Gets cached payload if it exists and hasn't expired.
 * @param {string} key
 * @returns {any|null}
 */
export function getCache(key) {
  const store = ensureCacheLoaded();
  const entry = store[key];
  if (!entry) return null;

  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    delete store[key];
    persistCache();
    return null;
  }
  return entry.data;
}

/**
 * Sets item in cache with specified TTL in milliseconds.
 * @param {string} key
 * @param {any} data
 * @param {number} ttlMs Default 7 days
 */
export function setCache(key, data, ttlMs = 7 * 24 * 60 * 60 * 1000) {
  const store = ensureCacheLoaded();
  store[key] = {
    data,
    savedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  persistCache();
}
