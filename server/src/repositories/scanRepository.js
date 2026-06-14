import { prisma } from "../config/db.js";

export const scanRepository = {
  async create(data) {
    return prisma.scanResult.create({
      data: {
        ...data,
        ports: data.ports ? data.ports : [],
        misconfigs: data.misconfigs ? data.misconfigs : [],
        findings: data.findings ? data.findings : [],
        timeline: data.timeline ? data.timeline : [],
      },
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

  async update(id, data) {
    return prisma.scanResult.update({
      where: { id },
      data,
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
      data: {
        timeline,
        ...extra,
      },
    });
  },

  async delete(id, userId) {
    return prisma.scanResult.deleteMany({
      where: { id, userId },
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
};
