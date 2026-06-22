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
  companyName:     string;
  companyColor:    string;
  period:          string;
  currency:        Currency;
  revenue:         number;
  grossProfit:     number;
  operatingIncome: number;
  netIncome:       number;
}

interface Props {
  userName:       string;
  companiesCount: number;
  datasetsCount:  number;
  datasets:       DashboardDataset[];
}

// ─── حساب العملة السائدة (الأكثر تكراراً) ────────────────────────────────────
function dominantCurrency(datasets: DashboardDataset[]): Currency {
  const counts: Partial<Record<Currency, number>> = {};
  for (const d of datasets) counts[d.currency] = (counts[d.currency] ?? 0) + 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "SAR") as Currency;
}

// ─── صيغة مختصرة للأرقام على محور Y ─────────────────────────────────────────
function shortNum(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs}`;
}

export function DashboardClient({
  userName, companiesCount, datasetsCount, datasets,
}: Props) {

  const currency = useMemo(() => dominantCurrency(datasets), [datasets]);

  // ── الفترات المتاحة مرتبة تصاعدياً ──────────────────────────────────────────
  const periods = useMemo(
    () => [...new Set(datasets.map((d) => d.period))].sort(),
    [datasets]
  );

  const latestPeriod = periods.at(-1);
  const prevPeriod   = periods.at(-2);

  // ── بيانات الفترة الأخيرة والسابقة ───────────────────────────────────────────
  const latestData = useMemo(
    () => datasets.filter((d) => d.period === latestPeriod),
    [datasets, latestPeriod]
  );
  const prevData = useMemo(
    () => datasets.filter((d) => d.period === prevPeriod),
    [datasets, prevPeriod]
  );

  // ── مجاميع الفترة الأخيرة ────────────────────────────────────────────────────
  const totals = useMemo(() => ({
    revenue:         latestData.reduce((s, d) => s + d.revenue, 0),
    grossProfit:     latestData.reduce((s, d) => s + d.grossProfit, 0),
    operatingIncome: latestData.reduce((s, d) => s + d.operatingIncome, 0),
    netIncome:       latestData.reduce((s, d) => s + d.netIncome, 0),
  }), [latestData]);

  const netMargin      = totals.revenue > 0 ? (totals.netIncome / totals.revenue) * 100 : 0;
  const grossMargin    = totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0;
  const opMargin       = totals.revenue > 0 ? (totals.operatingIncome / totals.revenue) * 100 : 0;

  // ── مجاميع الفترة السابقة (للشركات الموجودة في الأخيرة فقط لتجنب التضليل) ──
  const latestCompanyNames = useMemo(
    () => new Set(latestData.map((d) => d.companyName)),
    [latestData]
  );
  const prevDataFiltered = useMemo(
    () => prevData.filter((d) => latestCompanyNames.has(d.companyName)),
    [prevData, latestCompanyNames]
  );
  const prevTotals = useMemo(() => ({
    revenue:         prevDataFiltered.reduce((s, d) => s + d.revenue, 0),
    grossProfit:     prevDataFiltered.reduce((s, d) => s + d.grossProfit, 0),
    operatingIncome: prevDataFiltered.reduce((s, d) => s + d.operatingIncome, 0),
    netIncome:       prevDataFiltered.reduce((s, d) => s + d.netIncome, 0),
  }), [prevDataFiltered]);

  function pctChange(curr: number, prev: number): number | null {
    if (prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  // ── بيانات المخطط الزمني (مجمَّع لكل فترة) ──────────────────────────────────
  const trendData = useMemo(() => {
    const map: Record<string, { revenue: number; grossProfit: number; operatingIncome: number; netIncome: number }> = {};
    for (const d of datasets) {
      if (!map[d.period]) map[d.period] = { revenue: 0, grossProfit: 0, operatingIncome: 0, netIncome: 0 };
      map[d.period].revenue         += d.revenue;
      map[d.period].grossProfit     += d.grossProfit;
      map[d.period].operatingIncome += d.operatingIncome;
      map[d.period].netIncome       += d.netIncome;
    }
    return periods.slice(-18).map((p) => ({
      period:         p.slice(0, 7),
      revenue:         map[p]?.revenue         ?? 0,
      grossProfit:     map[p]?.grossProfit     ?? 0,
      operatingIncome: map[p]?.operatingIncome ?? 0,
      netIncome:       map[p]?.netIncome       ?? 0,
    }));
  }, [datasets, periods]);

  // ── بيانات الشركات للفترة الأخيرة ────────────────────────────────────────────
  const companyRows = useMemo(() => {
    // نجمع باسم الشركة — ونحتفظ بأول لون نجده لكل شركة
    const map: Record<string, {
      revenue: number; grossProfit: number;
      operatingIncome: number; netIncome: number; color: string;
    }> = {};
    for (const d of latestData) {
      if (!map[d.companyName]) {
        map[d.companyName] = { revenue: 0, grossProfit: 0, operatingIncome: 0, netIncome: 0, color: d.companyColor };
      }
      map[d.companyName].revenue         += d.revenue;
      map[d.companyName].grossProfit     += d.grossProfit;
      map[d.companyName].operatingIncome += d.operatingIncome;
      map[d.companyName].netIncome       += d.netIncome;
    }
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        color:          v.color,
        revenue:        v.revenue,
        grossProfit:    v.grossProfit,
        operatingIncome: v.operatingIncome,
        netIncome:      v.netIncome,
        grossMargin:    v.revenue > 0 ? (v.grossProfit / v.revenue) * 100 : 0,
        netMargin:      v.revenue > 0 ? (v.netIncome   / v.revenue) * 100 : 0,
        share:          totals.revenue > 0 ? (v.revenue / totals.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [latestData, totals.revenue]);

  const isEmpty = datasets.length === 0;

  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-5 pb-4">

      {/* ── Hero Banner ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-green-dark) 0%, color-mix(in srgb, var(--brand-green) 65%, #0c1f0e) 100%)",
        }}
      >
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
          {/* رأس البانر */}
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

          {/* شريط KPI — 4 مقاييس */}
          {!isEmpty && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <HeroKPI
                label="إجمالي الإيرادات"
                value={formatCurrency(totals.revenue, currency, true)}
                change={pctChange(totals.revenue, prevTotals.revenue)}
              />
              <HeroKPI
                label="إجمالي الربح"
                value={formatCurrency(totals.grossProfit, currency, true)}
                change={pctChange(totals.grossProfit, prevTotals.grossProfit)}
                subLabel={`هامش ${grossMargin.toFixed(1)}%`}
              />
              <HeroKPI
                label="الدخل التشغيلي"
                value={formatCurrency(totals.operatingIncome, currency, true)}
                change={pctChange(totals.operatingIncome, prevTotals.operatingIncome)}
                subLabel={`هامش ${opMargin.toFixed(1)}%`}
              />
              <HeroKPI
                label="صافي الربح"
                value={formatCurrency(totals.netIncome, currency, true)}
                change={pctChange(totals.netIncome, prevTotals.netIncome)}
                subLabel={`هامش ${netMargin.toFixed(1)}%`}
                highlight={totals.netIncome >= 0}
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
          {/* ── المخططات ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* مخطط الاتجاه */}
            <div className="lg:col-span-3 rounded-2xl border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
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

              <div className="flex items-center gap-4 mb-3">
                <LegendDot color="var(--brand-green)" label="الإيرادات" />
                <LegendDot color="#3b82f6"            label="إجمالي الربح" />
                <LegendDot color="#10b981"            label="صافي الربح" />
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ left: -8, right: 4 }}>
                  <defs>
                    <linearGradient id="g-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--brand-green)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--brand-green)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-gross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-net" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                    tickFormatter={shortNum}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => {
                      const labels: Record<string, string> = {
                        revenue:         "الإيرادات",
                        grossProfit:     "إجمالي الربح",
                        operatingIncome: "الدخل التشغيلي",
                        netIncome:       "صافي الربح",
                      };
                      return [formatCurrency(v, currency, true), labels[name] ?? name];
                    }}
                    contentStyle={{
                      borderRadius: "0.75rem",
                      fontSize: "0.8rem",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="revenue"         stroke="var(--brand-green)" fill="url(#g-rev)"   strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="grossProfit"     stroke="#3b82f6"            fill="url(#g-gross)" strokeWidth={2}   dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="netIncome"       stroke="#10b981"            fill="url(#g-net)"   strokeWidth={2}   dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* حصة الشركات */}
            <div className="lg:col-span-2 rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2 font-semibold text-[0.95rem] mb-5">
                <span className="section-header-icon">
                  <Building2 size={14} />
                </span>
                حصة الشركات من الإيرادات
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[260px] pr-1">
                {companyRows.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-sm font-medium truncate max-w-[120px]" style={{ color: c.color }}>
                          {c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatCurrency(c.revenue, currency, true)}
                        </span>
                        <span
                          className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: c.color + "22", color: c.color }}
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

          {/* ── جدول أداء الشركات ── */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-muted/20 flex items-center gap-2">
              <span className="section-header-icon">
                <BarChart2 size={14} />
              </span>
              <span className="font-semibold text-[0.95rem]">
                أداء الشركات
              </span>
              <span className="text-xs text-muted-foreground">
                — {latestPeriod?.slice(0, 7)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs w-8">#</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs">الشركة</th>
                    <th className="text-left  px-4 py-3 font-medium text-muted-foreground text-xs">الإيرادات</th>
                    <th className="text-left  px-4 py-3 font-medium text-muted-foreground text-xs">إجمالي الربح</th>
                    <th className="text-left  px-4 py-3 font-medium text-muted-foreground text-xs">الدخل التشغيلي</th>
                    <th className="text-left  px-4 py-3 font-medium text-muted-foreground text-xs">صافي الربح</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">هامش الربح</th>
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
                      <td className="px-4 py-3.5 text-right text-muted-foreground text-xs font-medium">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="font-semibold text-sm">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-left font-mono text-sm">
                        {formatCurrency(c.revenue, currency, true)}
                      </td>
                      <td className="px-4 py-3.5 text-left font-mono text-sm">
                        <span className={c.grossProfit >= 0 ? "text-positive" : "text-negative"}>
                          {formatCurrency(c.grossProfit, currency, true)}
                        </span>
                        <span className="text-[10px] text-muted-foreground mr-1">
                          {c.grossMargin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-left font-mono text-sm">
                        <span className={c.operatingIncome >= 0 ? "text-positive" : "text-negative"}>
                          {formatCurrency(c.operatingIncome, currency, true)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-left font-mono text-sm">
                        <span className={cn("font-semibold", c.netIncome >= 0 ? "text-positive" : "text-negative")}>
                          {formatCurrency(c.netIncome, currency, true)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <MarginBar value={c.netMargin} />
                      </td>
                    </tr>
                  ))}

                  {/* صف الإجمالي */}
                  <tr
                    className="border-t-2"
                    style={{ backgroundColor: "color-mix(in srgb, var(--brand-green) 5%, transparent)" }}
                  >
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 font-bold text-sm">الإجمالي</td>
                    <td className="px-4 py-3 text-left font-mono font-bold text-sm">
                      {formatCurrency(totals.revenue, currency, true)}
                    </td>
                    <td className="px-4 py-3 text-left font-mono font-bold text-sm">
                      <span className={totals.grossProfit >= 0 ? "text-positive" : "text-negative"}>
                        {formatCurrency(totals.grossProfit, currency, true)}
                      </span>
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {grossMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left font-mono font-bold text-sm">
                      <span className={totals.operatingIncome >= 0 ? "text-positive" : "text-negative"}>
                        {formatCurrency(totals.operatingIncome, currency, true)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left font-mono font-bold text-sm">
                      <span className={totals.netIncome >= 0 ? "text-positive" : "text-negative"}>
                        {formatCurrency(totals.netIncome, currency, true)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MarginBar value={netMargin} bold />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── مقارنة بالفترة السابقة ── */}
          {prevPeriod && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CompareCard
                label="الإيرادات"
                current={totals.revenue}
                previous={prevTotals.revenue}
                currency={currency}
                prevPeriodLabel={prevPeriod.slice(0, 7)}
              />
              <CompareCard
                label="إجمالي الربح"
                current={totals.grossProfit}
                previous={prevTotals.grossProfit}
                currency={currency}
                prevPeriodLabel={prevPeriod.slice(0, 7)}
              />
              <CompareCard
                label="صافي الربح"
                current={totals.netIncome}
                previous={prevTotals.netIncome}
                currency={currency}
                prevPeriodLabel={prevPeriod.slice(0, 7)}
              />
              <div className="rounded-2xl border bg-card p-4 flex flex-col justify-between">
                <p className="text-xs text-muted-foreground font-medium">الشركات النشطة</p>
                <div className="mt-2">
                  <p className="text-2xl font-black text-foreground">{companyRows.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    في فترة {latestPeriod?.slice(0, 7)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── HeroKPI ───────────────────────────────────────────────────────────────────

function HeroKPI({
  label, value, change, subLabel, highlight,
}: {
  label:      string;
  value:      string;
  change?:    number | null;
  subLabel?:  string;
  highlight?: boolean;
}) {
  const up = (change ?? 0) >= 0;

  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        background: highlight === false
          ? "rgba(239,68,68,0.12)"
          : "rgba(255,255,255,0.09)",
        backdropFilter: "blur(10px)",
        border: highlight === false
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <p className="text-white/50 text-[11px] font-medium tracking-wide mb-1">{label}</p>
      <p className="text-white font-black text-xl leading-tight">{value}</p>

      <div className="flex items-center justify-between mt-1.5 gap-2">
        {subLabel && (
          <span className="text-white/40 text-[10px]">{subLabel}</span>
        )}
        {change != null && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-semibold shrink-0",
              up ? "text-emerald-300" : "text-red-300"
            )}
          >
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {up ? "+" : ""}{change.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ── LegendDot ─────────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ── MarginBar ─────────────────────────────────────────────────────────────────

function MarginBar({ value, bold }: { value: number; bold?: boolean }) {
  const capped = Math.min(Math.abs(value), 100);
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
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
          "text-xs w-12 text-right",
          bold ? "font-bold" : "font-semibold",
          value >= 0 ? "text-positive" : "text-negative"
        )}
      >
        {value >= 0 ? "" : "−"}{Math.abs(value).toFixed(1)}%
      </span>
    </div>
  );
}

// ── CompareCard ───────────────────────────────────────────────────────────────

function CompareCard({
  label, current, previous, currency, prevPeriodLabel,
}: {
  label:           string;
  current:         number;
  previous:        number;
  currency:        Currency;
  prevPeriodLabel: string;
}) {
  const change = previous !== 0
    ? ((current - previous) / Math.abs(previous)) * 100
    : null;
  const up = (change ?? 0) >= 0;

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p
        className={cn(
          "text-xl font-black mt-2",
          current >= 0 ? "text-foreground" : "text-negative"
        )}
      >
        {formatCurrency(current, currency, true)}
      </p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-muted-foreground">
          {prevPeriodLabel}: {formatCurrency(previous, currency, true)}
        </p>
        {change != null ? (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-bold",
              up ? "text-positive" : "text-negative"
            )}
          >
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        ) : (
          <Minus size={12} className="text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
