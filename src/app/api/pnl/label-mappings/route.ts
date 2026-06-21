import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.labelMapping.findMany();
  const mappings: Record<string, string> = {};
  for (const r of rows) mappings[r.label] = r.pnlKey;
  return NextResponse.json({ mappings });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mappings } = (await req.json()) as { mappings: Record<string, string> };
  if (!mappings || typeof mappings !== "object")
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  for (const [label, pnlKey] of Object.entries(mappings)) {
    if (!label || !pnlKey) continue;
    await prisma.labelMapping.upsert({
      where: { label },
      create: { label, pnlKey },
      update: { pnlKey },
    });
  }

  return NextResponse.json({ saved: Object.keys(mappings).length });
}
