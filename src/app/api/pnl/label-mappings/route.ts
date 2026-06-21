import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { label } = (await req.json()) as { label: string };
  if (!label) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await prisma.labelMapping.delete({ where: { label } });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.labelMapping.findMany();
  const mappings: Record<string, string> = {};
  const names: Record<string, string> = {};
  for (const r of rows) {
    mappings[r.label] = r.pnlKey;
    if (r.labelAr) names[r.label] = r.labelAr;
  }
  return NextResponse.json({ mappings, names });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    mappings: Record<string, string>;
    names?: Record<string, string>;
  };
  const { mappings, names } = body;
  if (!mappings || typeof mappings !== "object")
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  for (const [label, pnlKey] of Object.entries(mappings)) {
    if (!label || !pnlKey) continue;
    const labelAr = names?.[label] ?? null;
    await prisma.labelMapping.upsert({
      where:  { label },
      create: { label, pnlKey, labelAr },
      update: { pnlKey, ...(labelAr ? { labelAr } : {}) },
    });
  }

  return NextResponse.json({ saved: Object.keys(mappings).length });
}
