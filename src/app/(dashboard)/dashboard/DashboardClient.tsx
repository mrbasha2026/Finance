"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/lib/pnl-types";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Building2, BarChart2,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardDataset {
  companyName: string;
  companyColor: string;
  period: string;
  netIncome: number;
  revenue: number;
  currency: Currency;
}

interface Props {
  userName: string;
  companiesCount: number;
  datasetsCount: number;
  datasets: DashboardDataset[];
}

export function DashboardClient({ userName, companiesCount, datasetsCount, datasets }: Props) {
  const currency = datasets[0]?.currency ?? "SAR";

  const periods = useMemo(
    () => [...new Set(datasets.map((d) => d.period))].sort(),
    [datasets]
  );

  const latestPeriod = periods.at(-1);
  const prevPeriod   = periods.at(-2);

  const latestData = useMemo(
    () => datasets.filter((d) => d.period === latestPeriod),
    [datasets, latestPeriod]
  );
  const prevData = useMemo(
    () => datasets.filter((d) => d.period === prevPeriod),
    [datasets, prevPeriod]
  );

  const totalRevenue    = latestData.reduce((s, d) => s + d.revenue, 0);
  const totalNetIncome  = latestData.reduce((s, d) => s + d.netIncome, 0);
  const netMargin       = totalRevenue > 0 ? (totalNetIncome / totalRevenue) * 100 : 0;

  const prevRevenue    = prevData.reduce((s, d) => s + d.revenue, 0);
  const prevNetIncome  = prevData.reduce((s, d) => s + d.netIncome, 0);

  const revenueChange    = prevRevenue !== 0 ? ((totalRevenue - prevRevenue) / Math.abs(prevRevenue)) * 100 : null;
  const netIncomeChange  = prevNetIncome !== 0 ? ((totalNetIncome - prevNetIncome) / Math.abs(prevNetIncome)) * 100 : null;

  const trendData = useMemo(() => {
    const map: Record<string, { revenue: number; netIncome: number }> = {};
    for (const d of datasets) {
      if (!map[d.period]) map[d.period] = { revenue: 0, netIncome: 0 };
      map[d.period].revenue    += d.revenue;
      map[d.period].netIncome  += d.netIncome;
    }
    return periods.slice(-18).map((p) => ({
      period: p.slice(0, 7),
      revenue:   map[p]?.revenue   ?? 0,
      netIncome: map[p]?.netIncome ?? 0,
    }));
  }, [datasets, periods]);

  const companyRows = useMemo(() => {
    const map: Record<string, { revenue: number; netIncome: number; color: string }> = {};
    for (const d of latestData) {
      if (!map[d.companyName]) map[d.companyName] = { revenue: 0, netIncome: 0, color: d.companyColor };
      map[d.companyName].revenue   += d.revenue;
      map[d.companyName].netIncome += d.netIncome;
    }
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        color:     v.color,
        revenue:   v.revenue,
        netIncome: v.netIncome,
        margin:    v.revenue > 0 ? (v.netIncome / v.revenue) * 100 : 0,
        share:     totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [latestData, totalRevenue]);

  const isEmpty = datasets.length === 0;

  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-5 pb-4">

      {/* ── Hero ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-green-dark) 0%, color-mix(in srgb, var(--brand-green) 65%, #0c1f0e) 100%)",
        }}
      >
        {/* Decorative glows */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 15% 50%,  rgba(255,255,255,0.07) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%,  rgba(255,255,255,0.04) 0%, transparent 45%),
              radial-gradient(ellipse at 60% 90%,  rgba(159,197,82,0.12) 0%, transparent 50%)
            `,
          }}
        />

        <div className="relative px-6 pt-5 pb-6">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-white/45 text-xs font-medium tracking-wide">{today}</p>
              <h1 className="text-white font-black text-[1.6rem] leading-tight mt-0.5">
                مرحباً، {userName}
              </h1>
              <p className="text-white/50 text-sm mt-1">
                {latestPeriod
                  ? `آخر فترة مالية: ${latestPeriod.slice(0, 7)}`
                  : "لا توجد بيانات بعد"}
              </p>
            </div>

            {/* Quick counts */}
            <div className="hidden sm:flex items-center gap-1 shrink-0 mt-1">
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.10)" }}
              >
                <Building2 size={14} className="text-white/60" />
                <div>
                  <p className="text-white font-black text-lg leading-none">{companiesCount}</p>
                  <p className="text-white/45 text-[10px] mt-0.5">شركة</p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.10)" }}
              >
                <BarChart2 size={14} className="text-white/60" />
                <div>
                  <p className="text-white font-black text-lg leading-none">{datasetsCount}</p>
                  <p className="text-white/45 text-[10px] mt-0.5">مجموعة بيانات</p>
                </div>
              </div>
            </div>
          </div>

          {/* KPI strip */}
          {!isEmpty && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <HeroKPI
                label="إجمالي الإيرادات"
                value={formatCurrency(totalRevenue, currency, true)}
                change={revenueChange}
              />
              <HeroKPI
                label="صافي الربح"
                value={formatCurrency(totalNetIncome, currency, true)}
                change={netIncomeChange}
              />
              <HeroKPI
                label="هامش الربح الصافي"
                value={`${netMargin >= 0 ? "" : "−"}${Math.abs(netMargin).toFixed(1)}%`}
                neutral
                positive={netMargin >= 0}
              />
            </div>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground text-sm">
          ابدأ برفع بيانات الأرباح والخسائر لعرض لوحة التحكم.
        </div>
      ) : (
        <>
          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Trend chart */}
            <div className="lg:col-span-3 rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 font-semibold text-[0.95rem]">
                  <span className="section-header-icon">
                    <TrendingUp size={14} />
                  </span>
                  اتجاه الأداء المالي
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                  آخر {trendData.length} فترة
                </span>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 mb-3">
                <LegendDot color="var(--brand-green)" label="الإيرادات" />
                <LegendDot color="#3b82f6" label="صافي الربح" />
              </div>

              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData} margin={{ left: -10, right: 4 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--brand-green)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--brand-green)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.20} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      const abs = Math.abs(v);
                      if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                      if (abs >= 1_000)    return `${(v / 1_000).toFixed(0)}K`;
                      return String(v);
                    }}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      formatCurrency(v, currency, true),
                      name === "revenue" ? "الإيرادات" : "صافي الربح",
                    ]}
                    contentStyle={{
                      borderRadius: "0.75rem",
                      fontSize: "0.8rem",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--brand-green)"
                    fill="url(#revGrad)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="netIncome"
                    stroke="#3b82f6"
                    fill="url(#netGrad)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Company share bars */}
            <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 font-semibold text-[0.95rem] mb-5">
                <span className="section-header-icon">
                  <Building2 size={14} />
                </span>
                حصة الشركات من الإيرادات
              </div>

              <div className="space-y-4">
                {companyRows.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: c.color }}
                        >
                          {c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatCurrency(c.revenue, currency, true)}
                        </span>
                        <span
                          className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: c.color + "22",
                            color: c.color,
                          }}
                        >
                          {c.share.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.share}%`, backgroundColor: c.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Company Performance Table ── */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[0.95rem]">
                <span className="section-header-icon">
                  <BarChart2 size={14} />
                </span>
                أداء الشركات
                <span className="text-xs text-muted-foreground font-normal">
                  — {latestPeriod?.slice(0, 7)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right px-5 py-3 font-medium text-muted-foreground text-xs">#</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">الشركة</th>
                    <th className="text-left  px-4 py-3 font-medium text-muted-foreground text-xs">الإيرادات</th>
                    <th className="text-left  px-4 py-3 font-medium text-muted-foreground text-xs">صافي الربح</th>
                    <th className="text-left  px-4 py-3 font-medium text-muted-foreground text-xs">الهامش الصافي</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">الحصة</th>
                  </tr>
                </thead>
                <tbody>
                  {companyRows.map((c, i) => (
                    <tr
                      key={c.name}
                      className={cn(
                        "border-b last:border-0 transition-colors hover:bg-muted/20",
                        i % 2 !== 0 && "bg-muted/5"
                      )}
                    >
                      <td className="px-5 py-3.5 text-right text-muted-foreground text-xs font-medium">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: c.color }}
                          />
                          <span className="font-semibold text-sm">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-left font-mono text-sm">
                        {formatCurrency(c.revenue, currency, true)}
                      </td>
                      <td className="px-4 py-3.5 text-left">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "font-mono font-semibold text-sm",
                              c.netIncome >= 0 ? "text-positive" : "text-negative"
                            )}
                          >
                            {formatCurrency(c.netIncome, currency, true)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-left">
                        <MarginBar value={c.margin} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${c.share}%`, backgroundColor: c.color }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground font-medium w-10 text-right">
                            {c.share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Totals */}
                  <tr
                    className="border-t-2"
                    style={{ backgroundColor: "color-mix(in srgb, var(--brand-green) 5%, transparent)" }}
                  >
                    <td className="px-5 py-3" />
                    <td className="px-4 py-3 font-bold text-sm">الإجمالي</td>
                    <td className="px-4 py-3 text-left font-mono font-bold text-sm">
                      {formatCurrency(totalRevenue, currency, true)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span
                        className={cn(
                          "font-mono font-bold text-sm",
                          totalNetIncome >= 0 ? "text-positive" : "text-negative"
                        )}
                      >
                        {formatCurrency(totalNetIncome, currency, true)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <MarginBar value={netMargin} bold />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        100%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Period comparison strip (only if prev period exists) ── */}
          {prevPeriod && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CompareCard
                label="الإيرادات"
                current={totalRevenue}
                previous={prevRevenue}
                currency={currency}
                prevPeriodLabel={prevPeriod.slice(0, 7)}
              />
              <CompareCard
                label="صافي الربح"
                current={totalNetIncome}
                previous={prevNetIncome}
                currency={currency}
                prevPeriodLabel={prevPeriod.slice(0, 7)}
              />
              <CompareCard
                label="هامش الربح الحالي"
                current={netMargin}
                previous={prevRevenue > 0 ? (prevNetIncome / prevRevenue) * 100 : 0}
                isPercent
                prevPeriodLabel={prevPeriod.slice(0, 7)}
              />
              <div className="rounded-2xl border bg-card p-4 flex flex-col justify-between">
                <p className="text-xs text-muted-foreground font-medium">عدد الشركات النشطة</p>
                <div className="mt-2">
                  <p className="text-2xl font-black text-foreground">{companyRows.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">في الفترة {latestPeriod?.slice(0, 7)}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroKPI({
  label, value, change, neutral, positive,
}: {
  label: string;
  value: string;
  change?: number | null;
  neutral?: boolean;
  positive?: boolean;
}) {
  const up = (change ?? 0) >= 0;

  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        background: "rgba(255,255,255,0.09)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <p className="text-white/50 text-[11px] font-medium tracking-wide mb-1">{label}</p>
      <p className="text-white font-black text-xl leading-tight">{value}</p>

      {!neutral && change != null && (
        <div
          className={cn(
            "flex items-center gap-1 mt-1.5 text-[11px] font-semibold",
            up ? "text-emerald-300" : "text-red-300"
          )}
        >
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {up ? "+" : ""}{change.toFixed(1)}% مقارنة بالفترة السابقة
        </div>
      )}

      {neutral && positive !== undefined && (
        <div className={cn("text-[11px] font-semibold mt-1.5", positive ? "text-emerald-300" : "text-red-300")}>
          {positive ? "ربح ✓" : "خسارة"}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-0.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function MarginBar({ value, bold }: { value: number; bold?: boolean }) {
  const capped = Math.min(Math.abs(value), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${capped}%`,
            backgroundColor: value >= 0 ? "var(--brand-green)" : "#ef4444",
          }}
        />
      </div>
      <span
        className={cn(
          "text-xs",
          bold ? "font-bold" : "font-semibold",
          value >= 0 ? "text-positive" : "text-negative"
        )}
      >
        {value >= 0 ? "" : "−"}{Math.abs(value).toFixed(1)}%
      </span>
    </div>
  );
}

function CompareCard({
  label, current, previous, currency, isPercent, prevPeriodLabel,
}: {
  label: string;
  current: number;
  previous: number;
  currency?: Currency;
  isPercent?: boolean;
  prevPeriodLabel: string;
}) {
  const change = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const up = (change ?? 0) >= 0;
  const fmt = (v: number) =>
    isPercent
      ? `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(1)}%`
      : formatCurrency(v, currency ?? "SAR", true);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-xl font-black mt-2 text-foreground">{fmt(current)}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-muted-foreground">{prevPeriodLabel}: {fmt(previous)}</p>
        {change != null && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-bold",
              up ? "text-positive" : "text-negative"
            )}
          >
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {change == null && <Minus size={12} className="text-muted-foreground" />}
      </div>
    </div>
  );
}
