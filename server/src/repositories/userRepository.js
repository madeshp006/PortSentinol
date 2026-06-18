import { prisma } from "../config/db.js";

export const userRepository = {
  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  async create(data) {
    return prisma.user.create({
      data,
    });
  },

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  async countAll() {
    return prisma.user.count();
  },

  async countActive() {
    return prisma.user.count({
      where: { isActive: true },
    });
  },

  async findAll() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  async delete(id) {
    return prisma.user.delete({
      where: { id },
    });
  },
};
