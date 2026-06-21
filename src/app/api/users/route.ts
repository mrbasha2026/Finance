import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  roleId: z.string(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes("users.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      twoFactorEnabled: true,
      twoFactorForced: true,
      isActive: true,
      createdAt: true,
      userRoles: { include: { role: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes("users.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

  const { email, name, password, roleId } = parsed.data;
  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashed,
      userRoles: { create: { roleId } },
    },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
