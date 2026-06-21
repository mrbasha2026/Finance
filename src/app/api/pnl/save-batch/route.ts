import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { inferCalculatedRows } from "@/lib/pnl-calculations";
import { getAccessibleCompanyIds } from "@/lib/company-access";
import { z } from "zod";

const lineItemSchema = z.object({
  key: z.string().min(1),
  amount: z.number(),
});

const datasetSchema = z.object({
  companyId: z.string().optional(),
  companyName: z.string().min(1),
  period: z.string().min(1),
  currency: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  mode: z.enum(["merge", "replace"]).default("replace"),
});

const journalEntrySchema = z.object({
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

const bodySchema = z.object({
  datasets: z.array(datasetSchema).min(1),
  journalEntries: z.array(journalEntrySchema).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessibleIds = await getAccessibleCompanyIds(
      session.user.id,
      session.user.permissions
    );

    const datasets = await prisma.pnLDataset.findMany({
      where: accessibleIds !== null ? { companyId: { in: accessibleIds } } : undefined,
      orderBy: [{ companyName: "asc" }, { period: "desc" }],
      include: { company: { select: { color: true, currency: true } } },
    });

    return NextResponse.json({ datasets });
  } catch (error) {
    console.error("[GET /api/pnl/save-batch]", error);
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

    const rawBody = await req.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات غير صحيحة", details: parsed.error.flatten() }, { status: 400 });
    }

    const { datasets, journalEntries } = parsed.data;
    const results = [];

    const namesNeeded = datasets.filter((d) => !d.companyId).map((d) => d.companyName);
    const existingCompanies = namesNeeded.length
      ? await prisma.company.findMany({ where: { name: { in: namesNeeded } } })
      : [];
    const companyByName = new Map(existingCompanies.map((c) => [c.name, c]));

    for (const ds of datasets) {
      let companyId = ds.companyId;
      if (!companyId && ds.companyName) {
        let company = companyByName.get(ds.companyName);
        if (!company) {
          company = await prisma.$transaction(async (tx) => {
            const existing = await tx.company.findFirst({ where: { name: ds.companyName } });
            if (existing) return existing;
            return tx.company.create({
              data: { name: ds.companyName, currency: ds.currency, createdById: session.user.id },
            });
          });
          companyByName.set(ds.companyName, company);
        }
        companyId = company.id;
      }
      if (!companyId) continue;

      const rawData: Record<string, number> = {};
      for (const item of ds.lineItems) {
        rawData[item.key] = item.amount;
      }
      const fullData = inferCalculatedRows(rawData);
      let lineItems = Object.entries(fullData).map(([key, amount]) => ({ key, amount }));

      if (ds.mode === "merge") {
        const existing = await prisma.pnLDataset.findUnique({
          where: { companyId_period: { companyId, period: ds.period } },
          select: { parsed: true },
        });
        if (existing) {
          const existingItems = (existing.parsed as { lineItems: { key: string; amount: number }[] })?.lineItems ?? [];
          const merged = new Map(existingItems.map(({ key, amount }) => [key, amount]));
          for (const { key, amount } of lineItems) merged.set(key, amount);
          lineItems = Array.from(merged.entries()).map(([key, amount]) => ({ key, amount }));
        }
      }

      const saved = await prisma.pnLDataset.upsert({
        where: { companyId_period: { companyId, period: ds.period } },
        create: {
          companyId,
          companyName: ds.companyName,
          period: ds.period,
          currency: ds.currency,
          parsed: { lineItems },
          createdById: session.user.id,
        },
        update: {
          parsed: { lineItems },
          companyName: ds.companyName,
          currency: ds.currency,
        },
      });
      results.push(saved);

      // Grant the uploader access to this company if they aren't an admin
      if (!session.user.permissions.includes("companies.manage")) {
        await prisma.userCompany.upsert({
          where: { userId_companyId: { userId: session.user.id, companyId } },
          create: { userId: session.user.id, companyId },
          update: {},
        });
      }
    }

    const MAX_JOURNAL_ENTRIES = 5000;
    let journalSkipped = 0;
    if (journalEntries?.length) {
      const capped = journalEntries.slice(0, MAX_JOURNAL_ENTRIES);
      journalSkipped = journalEntries.length - capped.length;
      const BATCH = 500;
      const rows = capped.map((je) => ({ ...je, date: new Date(je.date) }));
      for (let i = 0; i < rows.length; i += BATCH) {
        await prisma.journalEntry.createMany({
          data: rows.slice(i, i + BATCH),
          skipDuplicates: true,
        });
      }
    }

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: "upload",
      module: "pnl",
      details: { count: results.length },
    });

    return NextResponse.json({ saved: results.length, journalSkipped });
  } catch (error) {
    console.error("[POST /api/pnl/save-batch]", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "حدث خطأ في الخادم", debug: msg }, { status: 500 });
  }
}
