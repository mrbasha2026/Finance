"use client";

import { useMemo } from "react";
import { TrendingUp, ArrowUp, ArrowDown, Minus, BarChart3, Sparkles } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { usePnLStore } from "@/store/pnl-store";
import { calculateKPIs, aggregateData, formatPeriodAr } from "@/lib/pnl-calculations";
import { forecastValues, formatNumber } from "@/lib/forecasting";
import Link from "next/link";

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (value > 0)
    return <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-semibold"><ArrowUp size={11} /> {value.toFixed(1)}%</span>;
  if (value < 0)
    return <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-semibold"><ArrowDown size={11} /> {Math.abs(value).toFixed(1)}%</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus size={11} /> 0%</span>;
}

export default function ForecastsPage() {
  const { companies } = usePnLStore();

  const { kpiHistory, chartData } = useMemo(() => {
    if (!companies?.length) return { kpiHistory: [], chartData: [] };

    const allPeriods = ([...new Set(companies.map((d) => d.period))] as string[]).sort();
    const kpiHist = allPeriods.map((period) => {
      const periodCompanies = companies.filter((d) => d.period === period);
      const aggregated = aggregateData(periodCompanies);
      const kpis = calculateKPIs(aggregated);
      return { period, ...kpis };
    });

    const forecastPeriods = 6;
    const revenueForecasts = forecastValues(kpiHist.map((h) => h.revenue ?? 0), forecastPeriods);
    const netIncomeForecasts = forecastValues(kpiHist.map((h) => h.netIncome ?? 0), forecastPeriods);

    const historicalChart = kpiHist.map((h) => ({
      period: formatPeriodAr(h.period, "monthly"),
      revenue: h.revenue,
      netIncome: h.netIncome,
      grossProfit: h.grossProfit,
    }));

    const lastPeriod = allPeriods[allPeriods.length - 1] as string;
    const [year, month] = lastPeriod.split("-").map(Number);
    const forecastChart = revenueForecasts.values.map((rev, i) => {
      const fDate = new Date(year, (month - 1) + i + 1);
      const p = `${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, "0")}`;
      return {
        period: formatPeriodAr(p, "monthly"),
        forecastRevenue: Math.round(rev),
        forecastNetIncome: Math.round(netIncomeForecasts.values[i]),
      };
    });

    return {
      kpiHistory: kpiHist,
      chartData: [...historicalChart, ...forecastChart],
    };
  }, [companies]);

  const latestKPI = kpiHistory[kpiHistory.length - 1];
  const prevKPI = kpiHistory[kpiHistory.length - 2];

  function growthRate(curr: number | undefined, prev: number | undefined) {
    if (!curr || !prev || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  if (!companies?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--brand-green) 12%, transparent)" }}>
          <TrendingUp size={32} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold">لا توجد بيانات للتنبؤ</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          قم برفع بيانات P&L أولاً لعرض التوقعات المالية
        </p>
        <Link href="/pnl-entry" className="btn-primary px-5 py-2.5">رفع البيانات</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp size={22} className="text-primary" />
            التوقعات المالية
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            توقعات بناءً على {kpiHistory.length} فترة تاريخية — الخط المتقطع يمثل التوقعات للـ 6 أشهر القادمة
          </p>
        </div>
        <Link
          href="/ai-analysis"
          className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          <Sparkles size={14} />
          التحليل الذكي الكامل
        </Link>
      </div>

      {/* بطاقات KPI */}
      {latestKPI && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "الإيرادات", value: latestKPI.revenue, growth: growthRate(latestKPI.revenue, prevKPI?.revenue) },
            { label: "إجمالي الربح", value: latestKPI.grossProfit, growth: growthRate(latestKPI.grossProfit, prevKPI?.grossProfit) },
            { label: "صافي الربح", value: latestKPI.netIncome, growth: growthRate(latestKPI.netIncome, prevKPI?.netIncome) },
            { label: "هامش الربح الصافي", value: latestKPI.netMargin, isPercent: true, growth: latestKPI.netMargin != null && prevKPI?.netMargin != null ? (latestKPI.netMargin - prevKPI.netMargin) : null },
          ].map(({ label, value, growth, isPercent }) => (
            <div key={label} className="bg-card rounded-xl border p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-lg font-black text-foreground">
                {value != null ? (isPercent ? `${value.toFixed(1)}%` : formatNumber(value)) : "—"}
              </p>
              <div className="mt-1"><TrendBadge value={growth ?? null} /></div>
            </div>
          ))}
        </div>
      )}

      {/* مخطط التوقعات */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">الإيرادات وصافي الربح — التاريخي والمتوقع</h3>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} width={70} />
            <Tooltip formatter={(v: number) => formatNumber(v)} />
            <Legend />
            <Line dataKey="revenue" name="الإيرادات" stroke="#9fc552" strokeWidth={2} dot={{ r: 3 }} />
            <Line dataKey="netIncome" name="صافي الربح" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line dataKey="forecastRevenue" name="إيرادات متوقعة" stroke="#9fc552" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            <Line dataKey="forecastNetIncome" name="ربح صافٍ متوقع" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-2">
          ملاحظة: التوقعات تعتمد على الانحدار الخطي وهي تقديرية — تشاور خبيراً مالياً للقرارات الكبيرة
        </p>
      </div>
    </div>
  );
}
