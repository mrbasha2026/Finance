import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import dynamic from "next/dynamic";

const DashboardClient = dynamic(
  () => import("./DashboardClient").then((m) => ({ default: m.DashboardClient }))
);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const [companiesCount, datasetsCount, recentLogs, topDatasets] = await Promise.all([
    prisma.company.count(),
    prisma.pnLDataset.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, userEmail: true, action: true, module: true, createdAt: true },
    }),
    prisma.pnLDataset.findMany({
      orderBy: { period: "desc" },
      take: 24,
      include: { company: { select: { name: true, color: true } } },
    }),
  ]);

  return (
    <DashboardClient
      userName={session?.user.name ?? ""}
      companiesCount={companiesCount}
      datasetsCount={datasetsCount}
      recentLogs={recentLogs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      }))}
      datasets={topDatasets.map((d) => ({
        companyName: d.companyName,
        companyColor: d.company.color,
        period: d.period,
        currency: d.currency,
        netIncome: (() => {
          const parsed = d.parsed as { lineItems: { key: string; amount: number }[] };
          return parsed.lineItems.find((li) => li.key === "net_income")?.amount ?? 0;
        })(),
        revenue: (() => {
          const parsed = d.parsed as { lineItems: { key: string; amount: number }[] };
          return parsed.lineItems.find((li) => li.key === "revenue")?.amount ?? 0;
        })(),
      }))}
    />
  );
}
