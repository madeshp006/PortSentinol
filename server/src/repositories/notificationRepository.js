import { prisma } from "../config/db.js";

export const notificationRepository = {
  async create(data) {
    return prisma.notification.create({
      data,
    });
  },

  async findByUserId(userId) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async markRead(id, userId) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  async countUnread(userId) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  },
};
