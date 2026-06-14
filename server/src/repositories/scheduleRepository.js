import { prisma } from "../config/db.js";

export const scheduleRepository = {
  async create(data) {
    return prisma.schedule.create({
      data,
    });
  },

  async findByUserId(userId) {
    return prisma.schedule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id) {
    return prisma.schedule.findUnique({
      where: { id },
    });
  },

  async update(id, userId, data) {
    return prisma.schedule.updateMany({
      where: { id, userId },
      data,
    });
  },

  async delete(id, userId) {
    return prisma.schedule.deleteMany({
      where: { id, userId },
    });
  },

  async countAll() {
    return prisma.schedule.count();
  },
};
