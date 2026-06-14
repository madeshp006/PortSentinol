import { prisma } from "../config/db.js";

export const auditLogRepository = {
  async create(data) {
    return prisma.auditLog.create({
      data: {
        ...data,
        metadata: data.metadata ? data.metadata : {},
      },
    });
  },

  async findRecent(limit = 50) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
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

  async countAll() {
    return prisma.auditLog.count();
  },
};
