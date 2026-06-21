"use client";

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { calculateKPIs, aggregateData } from "@/lib/pnl-calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CompanyPnL, PeriodGroup } from "@/lib/pnl-types";

const COLORS = ["#0d9488", "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308"];

interface Props {
  data: Record<string, number>;
  prevData: Record<string, number> | null;
  datasets: CompanyPnL[];
  periodGroups: PeriodGroup[];
  chartType: string;
  currency: string;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function PnLCharts({ data, prevData, datasets, periodGroups, chartType, currency }: Props) {
  const curr = currency as "SAR";

  const trendData = periodGroups.map((g) => {
    const ds = datasets.filter((c) => g.months.includes(c.period));
    const aggData = aggregateData(ds);
    const kpis = calculateKPIs(aggData);
    return {
      period: g.labelAr,
      revenue: aggData["revenue"] ?? 0,
      gross_profit: aggData["gross_profit"] ?? 0,
      operating_income: aggData["operating_income"] ?? 0,
      net_income: aggData["net_income"] ?? 0,
      grossMargin: kpis.grossMargin,
      operatingMargin: kpis.operatingMargin,
      netMargin: kpis.netMargin,
      expenses: aggData["operating_expenses"] ?? 0,
    };
  });

  const fmt = (v: number) => formatCurrency(v, curr, true);

  // ── مخطط الأعمدة المقارن للإيرادات والأرباح ──────────────────────────────
  if (chartType === "column" || chartType === "bar") {
    const isVertical = chartType === "column";
    return (
      <ChartCard title="مقارنة الإيرادات والأرباح عبر الفترات">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={trendData} layout={isVertical ? "horizontal" : "vertical"}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            {isVertical ? (
              <>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              </>
            ) : (
              <>
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11 }} />
                <YAxis dataKey="period" type="category" tick={{ fontSize: 11 }} width={100} />
              </>
            )}
            <Tooltip formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend />
            <Bar dataKey="revenue" name="الإيرادات" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="gross_profit" name="إجمالي الربح" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="net_income" name="صافي الدخل" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  // ── مخطط الاتجاه الخطي للأرباح ───────────────────────────────────────────
  if (chartType === "line") {
    return (
      <ChartCard title="اتجاه الإيرادات والأرباح عبر الفترات">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [fmt(v)]} />
            <Legend />
            <Line type="monotone" dataKey="revenue" name="الإيرادات" stroke={COLORS[0]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="gross_profit" name="إجمالي الربح" stroke={COLORS[1]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="net_income" name="صافي الدخل" stroke={COLORS[2]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  // ── مخطط المساحة - تطور الإيرادات ────────────────────────────────────────
  if (chartType === "area") {
    return (
      <ChartCard title="تطور الإيرادات والأرباح عبر الفترات">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={trendData}>
            <defs>
              {COLORS.slice(0, 3).map((c, i) => (
                <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [fmt(v)]} />
            <Legend />
            <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke={COLORS[0]} fill="url(#grad0)" strokeWidth={2} />
            <Area type="monotone" dataKey="gross_profit" name="إجمالي الربح" stroke={COLORS[1]} fill="url(#grad1)" strokeWidth={2} />
            <Area type="monotone" dataKey="net_income" name="صافي الدخل" stroke={COLORS[2]} fill="url(#grad2)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  // ── مخطط توزيع التكاليف ──────────────────────────────────────────────────
  if (chartType === "pie") {
    const costSlices = [
      { name: "تكلفة البضاعة المباعة", value: data["cost_of_goods_sold"] ?? 0 },
      { name: "مصروفات البيع والتوزيع", value: data["selling_expenses"] ?? 0 },
      { name: "مصروفات إدارية وعمومية", value: data["general_admin_expenses"] ?? 0 },
      { name: "الاستهلاك والإطفاء", value: data["depreciation_amortization"] ?? 0 },
    ].filter((d) => d.value > 0);

    return (
      <ChartCard title="توزيع بنود التكاليف والمصروفات">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={costSlices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              labelLine={true}
            >
              {costSlices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [fmt(v)]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  // ── مخطط هوامش الربح عبر الفترات ─────────────────────────────────────────
  if (chartType === "margin") {
    return (
      <ChartCard title="تطور هوامش الربح الإجمالي والتشغيلي والصافي">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} />
            <Legend />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Line type="monotone" dataKey="grossMargin" name="هامش الربح الإجمالي %" stroke={COLORS[0]} strokeWidth={2} dot />
            <Line type="monotone" dataKey="operatingMargin" name="هامش الربح التشغيلي %" stroke={COLORS[1]} strokeWidth={2} dot />
            <Line type="monotone" dataKey="netMargin" name="هامش الربح الصافي %" stroke={COLORS[2]} strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  // ── مخطط التباين بين الفترة الحالية والسابقة ─────────────────────────────
  if (chartType === "variance" && prevData) {
    const KEYS = ["revenue", "gross_profit", "operating_income", "net_income"];
    const LABELS: Record<string, string> = {
      revenue: "الإيرادات",
      gross_profit: "إجمالي الربح",
      operating_income: "الدخل التشغيلي",
      net_income: "صافي الدخل",
    };
    const varianceData = KEYS.map((k) => ({
      name: LABELS[k],
      current: data[k] ?? 0,
      prev: prevData[k] ?? 0,
      variance: (data[k] ?? 0) - (prevData[k] ?? 0),
    }));

    return (
      <ChartCard title="مقارنة الفترة الحالية بالفترة السابقة والتباين بينهما">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={varianceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [fmt(v)]} />
            <Legend />
            <Bar dataKey="current" name="الفترة الحالية" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="prev" name="الفترة السابقة" fill={COLORS[4]} radius={[4, 4, 0, 0]} />
            <Line dataKey="variance" name="الفرق (التباين)" stroke={COLORS[2]} strokeWidth={2} dot />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  // ── مخطط شلال الربحية (من الإيرادات إلى صافي الدخل) ─────────────────────
  if (chartType === "waterfall") {
    const waterfallData = [
      { name: "الإيرادات", value: data["revenue"] ?? 0, fill: COLORS[0] },
      { name: "تكلفة البضاعة المباعة", value: -(data["cost_of_goods_sold"] ?? 0), fill: COLORS[4] },
      { name: "إجمالي الربح", value: data["gross_profit"] ?? 0, fill: COLORS[1] },
      { name: "مصروفات التشغيل", value: -(data["operating_expenses"] ?? 0), fill: COLORS[4] },
      { name: "صافي الدخل", value: data["net_income"] ?? 0, fill: COLORS[2] },
    ];

    return (
      <ChartCard title="مخطط شلال الربحية — من الإيرادات إلى صافي الدخل">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={waterfallData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [fmt(v)]} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {waterfallData.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  return null;
}
