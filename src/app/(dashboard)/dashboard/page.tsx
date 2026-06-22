import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCompanyIds } from "@/lib/company-access";
import type { Currency } from "@/lib/pnl-types";
import dynamic from "next/dynamic";

const DashboardClient = dynamic(
  () => import("./DashboardClient").then((m) => ({ default: m.DashboardClient }))
);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const accessibleIds = session
    ? await getAccessibleCompanyIds(session.user.id, session.user.permissions)
    : [];

  const datasetFilter = accessibleIds !== null ? { companyId: { in: accessibleIds } } : undefined;

  const [companiesCount, datasetsCount, topDatasets] = await Promise.all([
    prisma.company.count({ where: accessibleIds !== null ? { id: { in: accessibleIds } } : undefined }),
    prisma.pnLDataset.count({ where: datasetFilter }),
    prisma.pnLDataset.findMany({
      where: datasetFilter,
      orderBy: { period: "asc" },
      include: { company: { select: { color: true, currency: true } } },
    }),
  ]);

  return (
    <DashboardClient
      userName={session?.user.name ?? ""}
      companiesCount={companiesCount}
      datasetsCount={datasetsCount}
      datasets={topDatasets.map((d) => {
        const parsed = d.parsed as { lineItems: { key: string; amount: number }[] };
        const find = (key: string) => parsed.lineItems.find((li) => li.key === key)?.amount ?? 0;
        return {
          companyName: d.companyName,
          companyColor: d.company.color,
          period: d.period,
          currency: d.currency as Currency,
          netIncome: find("net_income"),
          revenue: find("revenue"),
        };
      })}
    />
  );
}
