import { prisma } from "../config/db.js";

const ALLOWED_SCAN_RESULT_FIELDS = new Set([
  "id",
  "userId",
  "target",
  "scanType",
  "portRange",
  "duration",
  "riskScore",
  "openPorts",
  "servicesDetected",
  "misconfigurations",
  "totalPorts",
  "ports",
  "misconfigs",
  "findings",
  "status",
  "progress",
  "currentStage",
  "scopeStatus",
  "workerMode",
  "errorMessage",
  "cancelRequested",
  "timeline",
  "driftEvents",
  "requestedAt",
  "startedAt",
  "finishedAt",
  "savedAt",
  "timestamp",
  "agentId",
  "scanJobId",
  "createdAt",
  "updatedAt",
  "user",
  "scanJob",
]);

function sanitizeScanData(data) {
  if (!data || typeof data !== "object") return data;
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (ALLOWED_SCAN_RESULT_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const scanRepository = {
  async create(data) {
    const raw = {
      ...data,
      ports: data.ports ? data.ports : [],
      misconfigs: data.misconfigs ? data.misconfigs : [],
      findings: data.findings ? data.findings : [],
      timeline: data.timeline ? data.timeline : [],
    };
    return prisma.scanResult.create({
      data: sanitizeScanData(raw),
    });
  },

  async findById(id) {
    return prisma.scanResult.findUnique({
      where: { id },
    });
  },

  async findByUserId(userId) {
    return prisma.scanResult.findMany({
      where: { userId },
      orderBy: [
        { requestedAt: "desc" },
        { createdAt: "desc" },
      ],
    });
  },

  async findPreviousScanByTarget(target, userId = null, excludeScanId = null) {
    const where = {
      target,
      status: "completed",
    };
    if (userId) {
      where.userId = userId;
    }
    if (excludeScanId) {
      where.id = { not: excludeScanId };
    }
    return prisma.scanResult.findFirst({
      where,
      orderBy: [
        { requestedAt: "desc" },
        { createdAt: "desc" },
      ],
    });
  },

  async update(id, data) {
    return prisma.scanResult.update({
      where: { id },
      data: sanitizeScanData(data),
    });
  },

  async appendTimeline(id, event, extra = {}) {
    const scan = await prisma.scanResult.findUnique({
      where: { id },
      select: { timeline: true },
    });
    if (!scan) return null;

    let timeline = [];
    if (scan.timeline) {
      timeline = typeof scan.timeline === "string" 
        ? JSON.parse(scan.timeline) 
        : (Array.isArray(scan.timeline) ? scan.timeline : []);
    }
    timeline.push(event);

    return prisma.scanResult.update({
      where: { id },
      data: sanitizeScanData({
        timeline,
        ...extra,
      }),
    });
  },

  async delete(id, userId) {
    return prisma.scanResult.deleteMany({
      where: { id, userId },
    });
  },

  async deleteGlobal(id) {
    return prisma.scanResult.delete({
      where: { id },
    });
  },

  async findByStatus(status) {
    return prisma.scanResult.findMany({
      where: { status },
    });
  },

  async countAll() {
    return prisma.scanResult.count();
  },

  async findAll() {
    return prisma.scanResult.findMany({
      orderBy: [
        { requestedAt: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async countSuccessful() {
    return prisma.scanResult.count({
      where: { status: "completed" },
    });
  },

  async countFailed() {
    return prisma.scanResult.count({
      where: { status: "failed" },
    });
  },
};
