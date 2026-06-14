import { auditLogRepository } from "../repositories/auditLogRepository.js";

export async function logAudit({ userId = null, action, entityType, entityId = "", metadata = {} }) {
  try {
    await auditLogRepository.create({ userId, action, entityType, entityId, metadata });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}
