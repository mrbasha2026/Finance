import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const entrySchema = z.object({
  companyName: z.string(),
  period: z.string(),
  date: z.string(),
  entryNumber: z.string(),
  accountKey: z.string(),
  accountNameAr: z.string(),
  description: z.string().optional(),
  debit: z.number(),
  credit: z.number(),
  reference: z.string().optional(),
  currency: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const companyName = searchParams.get("companyName") ?? undefined;
    const accountKey = searchParams.get("accountKey") ?? undefined;
    const periodsArr = searchParams.getAll("periods[]");
    const periodSingle = searchParams.get("period") ?? undefined;
    const periods = periodsArr.length > 0 ? periodsArr : periodSingle ? [periodSingle] : [];

    const andConditions: Record<string, unknown>[] = [];
    if (companyName) andConditions.push({ companyName });
    if (periods.length > 0) andConditions.push({ period: periods.length === 1 ? periods[0] : { in: periods } });

    if (accountKey) {
      const reverseMapped = await prisma.labelMapping.findMany({ where: { pnlKey: accountKey } });
      const matchingCats = await prisma.category.findMany({ where: { pnlKey: accountKey } });
      const keyVariants = [...new Set([
        accountKey,
        ...reverseMapped.map((m) => m.label),
        ...matchingCats.flatMap((c) => [c.nameAr, c.name]),
      ].filter(Boolean))];
      const nameArVariants = [...new Set(matchingCats.map((c) => c.nameAr).filter(Boolean))];

      andConditions.push({
        OR: [
          { accountKey: { in: keyVariants } },
          ...(nameArVariants.length > 0 ? [{ accountNameAr: { in: nameArVariants } }] : []),
        ],
      });
    }

    const entries = await prisma.journalEntry.findMany({
      where: andConditions.length > 0 ? { AND: andConditions } : {},
      orderBy: [{ date: "desc" }, { entryNumber: "asc" }],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[GET /api/journal-entries]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.permissions?.includes("pnl.upload")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const bodySchema = z.object({
      entries: z.array(entrySchema).min(1),
      clearPeriods: z.array(z.object({ companyName: z.string(), period: z.string() })).optional(),
    });
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
    }

    // Delete existing entries for the specified periods before inserting (prevents duplicates on re-upload)
    if (parsed.data.clearPeriods?.length) {
      for (const { companyName, period } of parsed.data.clearPeriods) {
        await prisma.journalEntry.deleteMany({ where: { companyName, period } });
      }
    }

    const result = await prisma.journalEntry.createMany({
      data: parsed.data.entries.map((e) => ({ ...e, date: new Date(e.date) })),
    });

    return NextResponse.json({ saved: result.count });
  } catch (error) {
    console.error("[POST /api/journal-entries]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
