"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { calculateKPIs, aggregateData, inferDynamic } from "@/lib/pnl-calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CompanyPnL, PnLKPIs, PeriodGroup } from "@/lib/pnl-types";
import { cn } from "@/lib/utils";
import { DynamicCategory } from "@/lib/category-types";
import { CompanyPeriodData } from "./page";

export type HoldingChartType =
  | "profit_bar"
  | "rev_exp"
  | "ranking"
  | "pie_contribution"
  | "trend_line"
  | "margin_comparison"
  | "waterfall_consolidated"
  | "heatmap"
  | "period_column"
  | "growth";

interface Props {
  periodDataByCompany: CompanyPeriodData[];
  prevPeriodDataByCompany: CompanyPeriodData[] | null;
  consolidatedData: Record<string, number>;
  periodGroups: PeriodGroup[];
  allCompanyDatasets: CompanyPnL[];
  selectedCompanyNames: string[];
  categories: DynamicCategory[];
  chartType: HoldingChartType;
  currency: string;
}

const fmt = (v: number) => formatCurrency(v, "SAR", true);
const TICK = { fontSize: 11 };
const GRID = { strokeDasharray: "3 3", stroke: "hsl(var(--border))" };

export function HoldingCharts({
  periodDataByCompany,
  prevPeriodDataByCompany,
  consolidatedData,
  periodGroups,
  allCompanyDatasets,
  selectedCompanyNames,
  categories,
  chartType,
}: Props) {
  if (periodDataByCompany.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground rounded-xl border bg-card">
        لا توجد بيانات للعرض
      </div>
    );
  }

  // ── 1. Company Profit Comparison Bar Chart ───────────────────────────────────
  if (chartType === "profit_bar") {
    const data = periodDataByCompany.map((c) => ({
      name: c.name,
      value: c.kpis.netIncome,
      fill: c.color,
    }));
    return (
      <ChartWrapper title="مقارنة صافي الربح بين الشركات">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical" margin={{ right: 20 }}>
            <CartesianGrid {...GRID} horizontal={false} />
            <XAxis type="number" tickFormatter={fmt} tick={TICK} />
            <YAxis type="category" dataKey="name" tick={TICK} width={110} />
            <Tooltip formatter={(v: number) => [fmt(v), "صافي الربح"]} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // ── 2. Revenue vs Expense Chart ───────────────────────────────────────────────
  if (chartType === "rev_exp") {
    const data = periodDataByCompany.map((c) => {
      // المصروفات = الإيرادات - صافي الدخل (مشتقة من القيم المحسوبة)
      const totalExpenses = c.kpis.revenue - c.kpis.netIncome;
      return {
        name: c.name,
        الإيرادات: c.kpis.revenue,
        المصروفات: totalExpenses,
        "صافي الربح": c.kpis.netIncome,
      };
    });
    return (
      <ChartWrapper title="الإيرادات مقابل المصروفات مقابل صافي الربح">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" tick={TICK} />
            <YAxis tickFormatter={fmt} tick={TICK} />
            <Tooltip formatter={(v: number, name) => [fmt(v), name]} />
            <Legend />
            <Bar dataKey="الإيرادات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="المصروفات" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="صافي الربح" fill="#0d9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // ── 3. Company Ranking Chart ──────────────────────────────────────────────────
  if (chartType === "ranking") {
    const sorted = [...periodDataByCompany].sort((a, b) => b.kpis.netIncome - a.kpis.netIncome);
    const data = sorted.map((c, i) => ({
      name: `${i + 1}. ${c.name}`,
      value: c.kpis.netIncome,
      fill: c.color,
    }));
    return (
      <ChartWrapper title="ترتيب الشركات حسب الربحية">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical" margin={{ right: 20 }}>
            <CartesianGrid {...GRID} horizontal={false} />
            <XAxis type="number" tickFormatter={fmt} tick={TICK} />
            <YAxis type="category" dataKey="name" tick={TICK} width={130} />
            <Tooltip formatter={(v: number) => [fmt(v), "صافي الربح"]} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // ── 4. Profit Contribution Pie Chart ─────────────────────────────────────────
  if (chartType === "pie_contribution") {
    const positiveData = periodDataByCompany.filter((c) => c.kpis.netIncome > 0);
    const revenueData = periodDataByCompany.filter((c) => c.kpis.revenue > 0);
    return (
      <ChartWrapper title="نسبة مساهمة كل شركة في أرباح المجموعة">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-center text-sm text-muted-foreground mb-2">مساهمة صافي الربح</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={positiveData.map((c) => ({ name: c.name, value: c.kpis.netIncome, fill: c.color }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {positiveData.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [fmt(v)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-center text-sm text-muted-foreground mb-2">مساهمة الإيرادات</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={revenueData.map((c) => ({ name: c.name, value: c.kpis.revenue, fill: c.color }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {revenueData.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [fmt(v)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartWrapper>
    );
  }

  // ── 5. Profit Trend Line Chart ────────────────────────────────────────────────
  if (chartType === "trend_line") {
    const trendData = periodGroups.map((g) => {
      const point: Record<string, number | string> = { period: g.labelAr };
      selectedCompanyNames.forEach((name) => {
        const ds = allCompanyDatasets.filter(
          (c) => c.companyName === name && g.months.includes(c.period)
        );
        point[name] = calculateKPIs(inferDynamic(aggregateData(ds), categories)).netIncome;
      });
      return point;
    });

    return (
      <ChartWrapper title="تطور أرباح الشركات عبر الفترات">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendData}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="period" tick={TICK} />
            <YAxis tickFormatter={fmt} tick={TICK} />
            <Tooltip formatter={(v: number, name) => [fmt(v), name]} />
            <Legend />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            {selectedCompanyNames.map((name, i) => {
              const color = periodDataByCompany.find((c) => c.name === name)?.color ?? "#0d9488";
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: color }}
                  activeDot={{ r: 6 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // ── 6. Profit Margin Comparison Chart ─────────────────────────────────────────
  if (chartType === "margin_comparison") {
    const data = periodDataByCompany.map((c) => ({
      name: c.name,
      "هامش إجمالي %": c.kpis.grossMargin,
      "هامش تشغيلي %": c.kpis.operatingMargin,
      "هامش صافي %": c.kpis.netMargin,
    }));
    return (
      <ChartWrapper title="مقارنة هامش الربح % بين الشركات">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" tick={TICK} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={TICK} />
            <Tooltip formatter={(v: number, name) => [`${v.toFixed(1)}%`, name]} />
            <Legend />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="هامش إجمالي %" fill="#0d9488" radius={[4, 4, 0, 0]} />
            <Bar dataKey="هامش تشغيلي %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="هامش صافي %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // ── 7. Waterfall Consolidated Chart ──────────────────────────────────────────
  if (chartType === "waterfall_consolidated") {
    const revenue     = consolidatedData["revenue"]          ?? 0;
    const grossProfit = consolidatedData["gross_profit"]      ?? 0;
    const opIncome    = consolidatedData["operating_income"]  ?? 0;
    const netIncome   = consolidatedData["net_income"]        ?? 0;
    const cogs        = revenue - grossProfit;
    const totalOpEx   = grossProfit - opIncome;

    const data = [
      { name: "الإيرادات",       value:  revenue,     fill: "#0d9488" },
      { name: "تكلفة البضاعة",  value: -cogs,        fill: "#ef4444" },
      { name: "إجمالي الربح",    value:  grossProfit, fill: "#3b82f6" },
      { name: "مصروفات التشغيل", value: -totalOpEx,   fill: "#f97316" },
      { name: "صافي الربح",      value:  netIncome,   fill: netIncome >= 0 ? "#10b981" : "#ef4444" },
    ];

    return (
      <ChartWrapper title="تكوين ربح المجموعة الموحدة (Waterfall)">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" tick={TICK} />
            <YAxis tickFormatter={fmt} tick={TICK} />
            <Tooltip formatter={(v: number) => [fmt(v)]} />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // ── 8. Company Performance Heatmap ───────────────────────────────────────────
  if (chartType === "heatmap") {
    const recentGroups = periodGroups.slice(-12);
    const heatData = selectedCompanyNames.map((name) => {
      const color = periodDataByCompany.find((c) => c.name === name)?.color ?? "#0d9488";
      const periods = recentGroups.map((g) => {
        const ds = allCompanyDatasets.filter(
          (c) => c.companyName === name && g.months.includes(c.period)
        );
        const netIncome = calculateKPIs(inferDynamic(aggregateData(ds), categories)).netIncome;
        return { label: g.labelAr, netIncome };
      });
      return { name, color, periods };
    });

    const allValues = heatData.flatMap((c) => c.periods.map((p) => p.netIncome));
    const maxVal = Math.max(...allValues.map(Math.abs), 1);

    const getCellStyle = (val: number) => {
      if (val === 0) return { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" };
      const intensity = Math.min(Math.abs(val) / maxVal, 1);
      if (val > 0) {
        return {
          backgroundColor: `rgba(13, 148, 136, ${0.15 + intensity * 0.75})`,
          color: intensity > 0.5 ? "#fff" : "inherit",
        };
      }
      return {
        backgroundColor: `rgba(239, 68, 68, ${0.15 + intensity * 0.75})`,
        color: intensity > 0.5 ? "#fff" : "inherit",
      };
    };

    return (
      <ChartWrapper title="أداء الشركات حسب الفترات — صافي الربح">
        <div className="overflow-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>
                <th className="text-right px-3 py-2 font-semibold bg-muted/50 sticky left-0 z-10">الشركة</th>
                {recentGroups.map((g) => (
                  <th key={g.key} className="px-2 py-2 font-medium bg-muted/50 whitespace-nowrap text-center min-w-[80px]">
                    {g.labelAr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatData.map((row) => (
                <tr key={row.name}>
                  <td className="px-3 py-2 font-medium bg-card border-b sticky left-0 z-10 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                      {row.name}
                    </span>
                  </td>
                  {row.periods.map((p, i) => (
                    <td
                      key={i}
                      className="px-2 py-2 text-center border-b"
                      style={getCellStyle(p.netIncome)}
                    >
                      {p.netIncome !== 0 ? fmt(p.netIncome) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartWrapper>
    );
  }

  // ── 9. Period Comparison Column Chart ─────────────────────────────────────────
  if (chartType === "period_column") {
    const data = periodDataByCompany.map((c) => {
      const prev = prevPeriodDataByCompany?.find((p) => p.name === c.name);
      return {
        name: c.name,
        "الفترة الحالية": c.kpis.netIncome,
        "الفترة السابقة": prev?.kpis.netIncome ?? 0,
        fill: c.color,
      };
    });
    return (
      <ChartWrapper title="مقارنة الشركات بين الفترات — صافي الربح">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" tick={TICK} />
            <YAxis tickFormatter={fmt} tick={TICK} />
            <Tooltip formatter={(v: number, name) => [fmt(v), name]} />
            <Legend />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="الفترة الحالية" radius={[4, 4, 0, 0]} opacity={1}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Bar>
            <Bar dataKey="الفترة السابقة" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  // ── 10. Growth Comparison Chart ───────────────────────────────────────────────
  if (chartType === "growth") {
    const data = periodDataByCompany.map((c) => {
      const prev = prevPeriodDataByCompany?.find((p) => p.name === c.name);
      const revGrowth =
        prev && prev.kpis.revenue !== 0
          ? ((c.kpis.revenue - prev.kpis.revenue) / Math.abs(prev.kpis.revenue)) * 100
          : 0;
      const profitGrowth =
        prev && prev.kpis.netIncome !== 0
          ? ((c.kpis.netIncome - prev.kpis.netIncome) / Math.abs(prev.kpis.netIncome)) * 100
          : 0;
      return {
        name: c.name,
        "نمو الإيرادات %": Math.round(revGrowth * 10) / 10,
        "نمو صافي الربح %": Math.round(profitGrowth * 10) / 10,
        fill: c.color,
      };
    });

    return (
      <ChartWrapper title="نسبة نمو أرباح الشركات مقارنة بالفترة السابقة">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" tick={TICK} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={TICK} />
            <Tooltip formatter={(v: number, name) => [`${v.toFixed(1)}%`, name]} />
            <Legend />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="نمو الإيرادات %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="نمو صافي الربح %" fill="#0d9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>
    );
  }

  return null;
}

function ChartWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
