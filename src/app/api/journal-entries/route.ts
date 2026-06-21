import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
