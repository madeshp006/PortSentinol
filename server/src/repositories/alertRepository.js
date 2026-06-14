import { prisma } from "../config/db.js";

export const alertRepository = {
  async create(data) {
    return prisma.alert.create({
      data: {
        ...data,
        metadata: data.metadata ? data.metadata : {},
      },
    });
  },

  async findByUserId(userId) {
    return prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async markRead(id, userId) {
    return prisma.alert.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  },

  async markAllRead(userId) {
    return prisma.alert.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  },

  async deleteByUserId(userId) {
    return prisma.alert.deleteMany({
      where: { userId },
    });
  },

  async countUnread(userId) {
    return prisma.alert.count({
      where: { userId, read: false },
    });
  },

  async countAll() {
    return prisma.alert.count();
  },
};
