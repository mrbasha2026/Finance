import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCompanyIds } from "@/lib/company-access";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  color: z.string().default("#0d9488"),
  currency: z.string().default("SAR"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.permissions.includes("companies.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const accessibleIds = await getAccessibleCompanyIds(
      session.user.id,
      session.user.permissions
    );

    const companies = await prisma.company.findMany({
      where: accessibleIds !== null ? { id: { in: accessibleIds } } : undefined,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { pnlDatasets: true } },
        pnlDatasets: { orderBy: { period: "desc" }, take: 1, select: { period: true, createdAt: true } },
      },
    });

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("[GET /api/companies]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.permissions.includes("companies.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

    const company = await prisma.company.create({
      data: { ...parsed.data, createdById: session.user.id },
    });

    return NextResponse.json({ company });
  } catch (error) {
    console.error("[POST /api/companies]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
