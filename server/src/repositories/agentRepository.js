import { prisma } from "../config/db.js";

export const agentRepository = {
  async create(data) {
    return prisma.agent.create({
      data,
    });
  },

  async findByAgentId(agentId) {
    return prisma.agent.findUnique({
      where: { agentId },
    });
  },

  async findByApiKey(apiKey) {
    return prisma.agent.findUnique({
      where: { apiKey },
    });
  },

  async findByUserId(userId) {
    return prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id) {
    return prisma.agent.findUnique({
      where: { id },
    });
  },

  async update(id, data) {
    return prisma.agent.update({
      where: { id },
      data,
    });
  },

  async updateHeartbeat(agentId, deviceName, operatingSystem, version) {
    return prisma.agent.update({
      where: { agentId },
      data: {
        lastSeen: new Date(),
        status: "online",
        deviceName,
        operatingSystem,
        version,
      },
    });
  },

  async delete(id, userId) {
    return prisma.agent.deleteMany({
      where: { id, userId },
    });
  },

  async deleteGlobal(id) {
    return prisma.agent.delete({
      where: { id },
    });
  },

  async findAll() {
    return prisma.agent.findMany({
      orderBy: { createdAt: "desc" },
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
    return prisma.agent.count();
  },

  async countActive() {
    return prisma.agent.count({
      where: { status: "online" },
    });
  },

  async markOfflineAgents(threshold) {
    return prisma.agent.updateMany({
      where: {
        lastSeen: {
          lt: threshold,
        },
        status: {
          not: "offline",
        },
      },
      data: {
        status: "offline",
      },
    });
  },
};
