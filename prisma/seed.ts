import * as fs from "fs";
import * as path from "path";

// Load .env.local manually (ts-node doesn't use Next.js env loading)
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .forEach((line) => {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
    });
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  "pnl.view", "pnl.upload", "pnl.analyze",
  "companies.view", "companies.manage",
  "users.view", "users.manage",
  "roles.view", "roles.manage",
  "system.settings", "system.audit",
  "expenses.categories",
  "prepaid.view", "prepaid.manage",
  "forecasts.view",
];

async function main() {
  // System settings singleton
  await prisma.systemSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  // Admin role
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    create: { name: "admin", permissions: ALL_PERMISSIONS },
    update: { permissions: ALL_PERMISSIONS },
  });

  // Analyst role
  await prisma.role.upsert({
    where: { name: "محلل" },
    create: {
      name: "محلل",
      permissions: ["pnl.view", "pnl.analyze", "companies.view", "prepaid.view"],
    },
    update: {},
  });

  // Viewer role
  await prisma.role.upsert({
    where: { name: "مشاهد" },
    create: {
      name: "مشاهد",
      permissions: ["pnl.view", "companies.view"],
    },
    update: {},
  });

  // Default admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@fainance.app" },
    create: {
      email: "admin@fainance.app",
      name: "مدير النظام",
      password: hashedPassword,
    },
    update: {},
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    create: { userId: adminUser.id, roleId: adminRole.id },
    update: {},
  });

  // Sample company
  await prisma.company.upsert({
    where: { id: "demo-company-1" },
    create: {
      id: "demo-company-1",
      name: "شركة الأمل للتجارة",
      color: "#0d9488",
      currency: "SAR",
      createdById: adminUser.id,
    },
    update: {},
  });

  console.log("✅ Seed complete — admin@fainance.app / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
