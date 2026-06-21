import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { totalDayUnits } from "@/lib/prepaid-utils";

const patchSchema = z.object({
  companyId: z.string().optional(),
  vendorName: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

    const existing = await prisma.prepaidExpense.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { startDate, endDate, nameAr, ...rest } = parsed.data;
    const start = startDate ? new Date(startDate) : existing.startDate;
    const end = endDate ? new Date(endDate) : existing.endDate;
    const finalAmount = rest.amount ?? existing.amount;
    const units = totalDayUnits(start, end);
    const monthlyAmount = +(finalAmount / units).toFixed(2);
    const now = new Date();
    const status = now > end ? "completed" : "active";

    const expense = await prisma.prepaidExpense.update({
      where: { id },
      data: { ...rest, amount: finalAmount, startDate: start, endDate: end, monthlyAmount, status },
      include: { company: { select: { id: true, name: true, color: true } } },
    });

    if (nameAr !== undefined) {
      await prisma.$executeRaw`UPDATE "PrepaidExpense" SET "nameAr" = ${nameAr || null} WHERE id = ${id}`;
    }

    const [nameArRow] = await prisma.$queryRaw<{ nameAr: string | null }[]>`
      SELECT "nameAr" FROM "PrepaidExpense" WHERE id = ${id}
    `;

    return NextResponse.json({ expense: { ...expense, nameAr: nameArRow?.nameAr ?? null } });
  } catch (error) {
    console.error("[PATCH /api/prepaid/[id]]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.prepaidExpense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/prepaid/[id]]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
