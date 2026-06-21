"use client";

import { PnLKPIs } from "@/lib/pnl-types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FinancialTooltip } from "@/components/shared/FinancialTooltip";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const THRESHOLDS = {
  grossMargin: 30,
  operatingMargin: 15,
  ebitdaMargin: 20,
  netMargin: 10,
};

interface Props {
  data: Record<string, number>;
  kpis: PnLKPIs;
  currency: string;
}

export function ExecutiveSummary({ data, kpis, currency }: Props) {
  const curr = currency as "SAR";

  const ratios = [
    { label: "هامش إجمالي الربح", value: kpis.grossMargin, threshold: THRESHOLDS.grossMargin },
    { label: "هامش التشغيل", value: kpis.operatingMargin, threshold: THRESHOLDS.operatingMargin },
    { label: "هامش EBITDA", term: "EBITDA" as const, value: kpis.ebitdaMargin, threshold: THRESHOLDS.ebitdaMargin },
    { label: "هامش صافي الربح", value: kpis.netMargin, threshold: THRESHOLDS.netMargin },
    { label: "نسبة تكلفة البضاعة", value: kpis.revenue > 0 ? (data["cost_of_goods_sold"] ?? 0) / kpis.revenue * 100 : 0, threshold: 70 },
    { label: "نسبة مصروفات التشغيل", value: kpis.revenue > 0 ? (data["operating_expenses"] ?? 0) / kpis.revenue * 100 : 0, threshold: 50 },
  ];

  const keyFigures = [
    { label: "الإيرادات", value: kpis.revenue },
    { label: "إجمالي الربح", value: kpis.grossProfit },
    { label: "EBITDA", term: "EBITDA" as const, value: kpis.ebitda },
    { label: "الدخل التشغيلي", value: kpis.operatingIncome },
    { label: "صافي الدخل", value: kpis.netIncome },
  ];

  const costStructure = [
    { name: "تكلفة البضاعة", value: data["cost_of_goods_sold"] ?? 0 },
    { name: "مصروفات البيع", value: data["selling_expenses"] ?? 0 },
    { name: "مصروفات إدارية", value: data["general_admin_expenses"] ?? 0 },
    { name: "إهلاك", value: data["depreciation_amortization"] ?? 0 },
  ].filter((d) => d.value > 0);

  const totalCost = costStructure.reduce((s, d) => s + d.value, 0);
  const costWithPct = costStructure.map((d) => ({
    ...d,
    pct: totalCost > 0 ? (d.value / totalCost) * 100 : 0,
  }));

  return (
    <div className="space-y-4">
      {/* Ratio cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ratios.map((r) => {
          const good = r.label.includes("نسبة") ? r.value <= r.threshold : r.value >= r.threshold;
          return (
            <div
              key={r.label}
              className={cn(
                "rounded-xl border p-4",
                good
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20"
                  : "bg-red-50 border-red-200 dark:bg-red-950/20"
              )}
            >
              <p className="text-xs text-muted-foreground mb-1">
                {"term" in r ? <FinancialTooltip term={r.term as "EBITDA"}>{r.label}</FinancialTooltip> : r.label}
              </p>
              <p className={cn("text-xl font-bold", good ? "text-emerald-700 dark:text-emerald-400" : "text-red-600")}>
                {formatPercent(r.value)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                المستهدف: {formatPercent(r.threshold)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cost structure chart */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-3">هيكل التكاليف</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={costWithPct} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "النسبة"]} />
              <Bar dataKey="pct" fill="var(--brand-amber)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Key figures table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 font-semibold text-sm">الأرقام الرئيسية</div>
          <table className="w-full text-sm">
            <tbody>
              {keyFigures.map((f, i) => (
                <tr key={f.label} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                  <td className="px-4 py-2.5 font-medium">
                    {"term" in f ? <FinancialTooltip term={f.term as "EBITDA"}>{f.label}</FinancialTooltip> : f.label}
                  </td>
                  <td className={cn("px-4 py-2.5 text-left font-mono", f.value >= 0 ? "text-positive" : "text-negative")}>
                    {formatCurrency(f.value, curr, false)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
