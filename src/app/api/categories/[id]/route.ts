import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().min(1).optional(),
  type: z.string().optional(),
  parentId: z.string().nullable().optional(),
  pnlKey: z.string().optional(),
  sortOrder: z.number().optional(),
  isCalculated: z.boolean().optional(),
  isTotal: z.boolean().optional(),
  isSubtotal: z.boolean().optional(),
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
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

    const category = await prisma.category.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ category });
  } catch (error) {
    console.error("[PATCH /api/categories/[id]]", error);
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
    const cat = await prisma.category.findUnique({ where: { id } });
    if (cat) {
      await prisma.category.updateMany({
        where: { parentId: id },
        data: { parentId: cat.parentId ?? null },
      });
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/categories/[id]]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
