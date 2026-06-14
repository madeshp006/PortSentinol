import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database…");

  // Create default admin user
  const passwordHash = await bcrypt.hash("Admin@1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@portsentinel.io" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@portsentinel.io",
      passwordHash,
      role: "Administrator",
      company: "PortSentinel",
    },
  });

  console.log(`Admin user: ${admin.email} (id: ${admin.id})`);

  // Create welcome alert for admin
  await prisma.alert.upsert({
    where: { id: "seed-welcome-alert" },
    update: {},
    create: {
      id: "seed-welcome-alert",
      userId: admin.id,
      title: "Welcome to PortSentinel",
      message:
        "Your account is ready. Run your first scan to start building history.",
      risk: "info",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
