import { prisma } from "../server/db";
import { hashPassword } from "../server/auth/passwords";

async function seed() {
  const users = [
    { id: "1", username: "admin", password: "admin123", role: "admin", displayName: "系統管理員" },
    { id: "2", username: "manager", password: "manager123", role: "manager", displayName: "行銷總監" },
    { id: "3", username: "user", password: "user123", role: "user", displayName: "行銷專員" },
  ];
  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    const existing = await prisma.user.findFirst({
      where: { username: { equals: u.username, mode: "insensitive" } },
    });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: u.role,
          displayName: u.displayName,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          id: u.id,
          username: u.username,
          passwordHash,
          role: u.role,
          displayName: u.displayName,
        },
      });
    }
    console.log(`Seeded user: ${u.username}`);
  }
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
