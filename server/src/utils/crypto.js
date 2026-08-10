import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
// Derive a 32-byte key from app secret or fallback key
const SECRET_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || process.env.SESSION_SECRET || "PortSentinel-Secure-Encryption-Key-2026")
  .digest();

/**
 * Encrypts sensitive string using AES-256-GCM.
 * @param {string} text
 * @returns {string} Encrypted cipher string formatted as iv:authTag:encryptedData
 */
export function encryptCredential(text = "") {
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts cipher string back to plaintext.
 * @param {string} cipherText Formatted as iv:authTag:encryptedData
 * @returns {string} Plaintext
 */
export function decryptCredential(cipherText = "") {
  if (!cipherText || !cipherText.includes(":")) return "";
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return "";

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.warn("[crypto] Credential decryption failed:", err.message);
    return "";
  }
}
