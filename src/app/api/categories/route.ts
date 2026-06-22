import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  nameAr: z.string().min(1),
  type: z.string(),
  parentId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  pnlKey: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
  isCalculated: z.boolean().optional(),
  isTotal: z.boolean().optional(),
  isSubtotal: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.permissions.includes("expenses.categories") && !session.user.permissions.includes("pnl.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        children: {
          orderBy: { sortOrder: "asc" },
          include: { children: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[GET /api/categories]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.permissions.includes("expenses.categories")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

    const { name, nameAr, type, parentId, companyId, pnlKey, sortOrder, isCalculated, isTotal, isSubtotal } = parsed.data;
    const resolvedKey = pnlKey || name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    let resolvedSortOrder = sortOrder ?? 0;
    if (!sortOrder) {
      const lastSibling = await prisma.category.findFirst({
        where: { parentId: parentId ?? null },
        orderBy: { sortOrder: "desc" },
      });
      resolvedSortOrder = (lastSibling?.sortOrder ?? 0) + 10;
    }

    const category = await prisma.category.create({
      data: {
        name, nameAr, type,
        parentId: parentId ?? null,
        companyId: companyId ?? null,
        pnlKey: resolvedKey,
        sortOrder: resolvedSortOrder,
        isCalculated: isCalculated ?? false,
        isTotal: isTotal ?? false,
        isSubtotal: isSubtotal ?? false,
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("[POST /api/categories]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
