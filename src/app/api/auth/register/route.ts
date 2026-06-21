import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  // Only allow if no users exist yet (first-run admin registration)
  const count = await prisma.user.count();
  if (count > 0) {
    return NextResponse.json(
      { error: "التسجيل غير مسموح — يرجى التواصل مع المدير" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const { email, name, password } = parsed.data;
  const hashed = await bcrypt.hash(password, 12);

  // Ensure admin role exists
  let adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) {
    const allPerms = [
      "pnl.view", "pnl.upload", "pnl.analyze",
      "companies.view", "companies.manage",
      "users.view", "users.manage",
      "roles.view", "roles.manage",
      "system.settings", "system.audit",
      "expenses.categories",
      "prepaid.view", "prepaid.manage",
      "forecasts.view",
    ];
    adminRole = await prisma.role.create({
      data: { name: "admin", permissions: allPerms },
    });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashed,
      userRoles: { create: { roleId: adminRole.id } },
    },
  });

  // Ensure system settings singleton
  await prisma.systemSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
