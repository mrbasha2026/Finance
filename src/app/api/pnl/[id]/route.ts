import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { inferCalculatedRows } from "@/lib/pnl-calculations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const dataset = await prisma.pnLDataset.findUnique({ where: { id } });
    if (!dataset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ dataset });
  } catch (error) {
    console.error("[GET /api/pnl/[id]]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { keysToRemove } = await req.json() as { keysToRemove: string[] };

    const dataset = await prisma.pnLDataset.findUnique({ where: { id } });
    if (!dataset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = dataset.parsed as { lineItems: Array<{ key: string; amount: number }> };
    const removeSet = new Set(keysToRemove);

    const rawData: Record<string, number> = {};
    for (const item of parsed.lineItems) {
      if (!removeSet.has(item.key)) rawData[item.key] = item.amount;
    }
    const fullData = inferCalculatedRows(rawData);
    const newLineItems = Object.entries(fullData).map(([key, amount]) => ({ key, amount }));

    await prisma.pnLDataset.update({
      where: { id },
      data: { parsed: { lineItems: newLineItems } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/pnl/[id]]", error);
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
    await prisma.pnLDataset.delete({ where: { id } });
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "delete",
      module: "pnl",
      details: { datasetId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/pnl/[id]]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
