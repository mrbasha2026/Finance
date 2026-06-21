import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCompanyIds } from "@/lib/company-access";
import { z } from "zod";
import { totalDayUnits } from "@/lib/prepaid-utils";

const schema = z.object({
  companyId: z.string(),
  vendorName: z.string().min(1),
  nameAr: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default("SAR"),
  type: z.string().default("أخرى"),
  startDate: z.string(),
  endDate: z.string(),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.permissions.includes("prepaid.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const accessibleIds = await getAccessibleCompanyIds(
      session.user.id,
      session.user.permissions
    );

    const expenses = await prisma.prepaidExpense.findMany({
      where: accessibleIds !== null ? { companyId: { in: accessibleIds } } : undefined,
      orderBy: { createdAt: "desc" },
      include: { company: { select: { id: true, name: true, color: true } } },
    });

    const nameArRows = await prisma.$queryRaw<{ id: string; nameAr: string | null }[]>`
      SELECT id, "nameAr" FROM "PrepaidExpense"
    `;
    const nameArMap = new Map(nameArRows.map(r => [r.id, r.nameAr]));
    const enriched = expenses.map(e => ({ ...e, nameAr: nameArMap.get(e.id) ?? null }));

    return NextResponse.json({ expenses: enriched });
  } catch (error) {
    console.error("[GET /api/prepaid]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.permissions.includes("prepaid.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

    const { startDate, endDate, nameAr, companyId, vendorName, amount, currency, type, description } = parsed.data;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const units = totalDayUnits(start, end);
    const monthlyAmount = +( amount / units).toFixed(2);
    const now = new Date();
    const status = now > end ? "completed" : "active";

    const expense = await prisma.prepaidExpense.create({
      data: { companyId, vendorName, amount, currency, type, description: description || null, startDate: start, endDate: end, monthlyAmount, status },
      include: { company: { select: { id: true, name: true, color: true } } },
    });

    if (nameAr) {
      await prisma.$executeRaw`UPDATE "PrepaidExpense" SET "nameAr" = ${nameAr} WHERE id = ${expense.id}`;
    }

    return NextResponse.json({ expense: { ...expense, nameAr: nameAr ?? null } });
  } catch (error) {
    console.error("[POST /api/prepaid]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
