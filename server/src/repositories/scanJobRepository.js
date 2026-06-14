import { prisma } from "../config/db.js";

export const scanJobRepository = {
  async create(data) {
    return prisma.scanJob.create({
      data,
    });
  },

  async findPendingByAgent(agentId) {
    return prisma.scanJob.findMany({
      where: {
        agentId,
        status: "pending",
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async findById(id) {
    return prisma.scanJob.findUnique({
      where: { id },
      include: {
        scans: true,
      },
    });
  },

  async update(id, data) {
    return prisma.scanJob.update({
      where: { id },
      data,
    });
  },

  async countAll() {
    return prisma.scanJob.count();
  },
};
