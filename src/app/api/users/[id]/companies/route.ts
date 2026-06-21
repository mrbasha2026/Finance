import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  companyIds: z.array(z.string()),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes("users.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const rows = await prisma.userCompany.findMany({
    where: { userId: id },
    select: { companyId: true },
  });

  return NextResponse.json({ companyIds: rows.map((r) => r.companyId) });
}

// Replace all assigned companies for a user
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.permissions?.includes("users.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
    }

    const { companyIds } = parsed.data;

    await prisma.userCompany.deleteMany({ where: { userId: id } });

    if (companyIds.length > 0) {
      await prisma.userCompany.createMany({
        data: companyIds.map((companyId) => ({ userId: id, companyId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/users/[id]/companies]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
