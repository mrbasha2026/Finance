"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp, Brain, Sparkles, AlertTriangle,
  CheckCircle2, AlertCircle, ChevronDown, Loader2,
  BarChart3, ArrowUp, ArrowDown, Minus, Settings,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { usePnLStore } from "@/store/pnl-store";
import { calculateKPIs, aggregateData, formatPeriodAr } from "@/lib/pnl-calculations";
import {
  forecastValues, detectAlerts, formatNumber,
  type KPIHistory, type FinancialAlert,
} from "@/lib/forecasting";
import Link from "next/link";
import { FinancialTooltip } from "@/components/shared/FinancialTooltip";

type Tab = "forecasts" | "ai";
type PromptType = "comprehensive" | "risks" | "recommendations";
type ForecastPeriods = 3 | 6 | 12;

const PROMPT_LABELS: Record<PromptType, string> = {
  comprehensive: "تحليل شامل",
  risks:         "تحليل المخاطر",
  recommendations: "التوصيات الاستراتيجية",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-semibold">
        <ArrowUp size={11} /> {value.toFixed(1)}%
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-semibold">
        <ArrowDown size={11} /> {Math.abs(value).toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus size={11} /> 0%
    </span>
  );
}

function AlertCard({ alert }: { alert: FinancialAlert }) {
  const styles = {
    success: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", icon: <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />, text: "text-emerald-800 dark:text-emerald-300" },
    warning: { bg: "bg-amber-50 dark:bg-amber-900/20",   border: "border-amber-200 dark:border-amber-800",   icon: <AlertTriangle size={15} className="text-amber-600 shrink-0" />,  text: "text-amber-800 dark:text-amber-300" },
    danger:  { bg: "bg-red-50 dark:bg-red-900/20",       border: "border-red-200 dark:border-red-800",       icon: <AlertCircle size={15} className="text-red-600 shrink-0" />,     text: "text-red-800 dark:text-red-300" },
  }[alert.type];

  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${styles.bg} ${styles.border}`}>
      {styles.icon}
      <div>
        <p className={`text-xs font-bold ${styles.text}`}>{alert.titleAr}</p>
        <p className={`text-xs mt-0.5 ${styles.text} opacity-80`}>{alert.messageAr}</p>
      </div>
    </div>
  );
}

// ─── Forecasts Tab ───────────────────────────────────────────────────────────

function ForecastsTab() {
  const companies      = usePnLStore((s) => s.companies);
  const [company, setCompany]     = useState<string>("");
  const [fwdPeriods, setFwdPeriods] = useState<ForecastPeriods>(6);

  const companyNames = useMemo(
    () => [...new Set(companies.map((c) => c.companyName))],
    [companies]
  );

  const selectedCompany = company || companyNames[0] || "";

  // Sorted monthly datasets for selected company
  const datasets = useMemo(
    () =>
      companies
        .filter((c) => c.companyName === selectedCompany)
        .sort((a, b) => a.period.localeCompare(b.period)),
    [companies, selectedCompany]
  );

  const history: KPIHistory = useMemo(() => {
    const labels: string[]       = [];
    const revenue: number[]      = [];
    const grossProfit: number[]  = [];
    const netIncome: number[]    = [];
    const opMargin: number[]     = [];
    const grMargin: number[]     = [];

    for (const ds of datasets) {
      const kpis = calculateKPIs(ds.data);
      labels.push(formatPeriodAr(ds.period, "monthly"));
      revenue.push(kpis.revenue);
      grossProfit.push(kpis.grossProfit);
      netIncome.push(kpis.netIncome);
      opMargin.push(kpis.operatingMargin);
      grMargin.push(kpis.grossMargin);
    }

    return { labels, revenue, grossProfit, netIncome, operatingMargin: opMargin, grossMargin: grMargin };
  }, [datasets]);

  const agg = useMemo(
    () => (datasets.length > 0 ? calculateKPIs(aggregateData(datasets)) : null),
    [datasets]
  );

  const revForecast  = useMemo(() => forecastValues(history.revenue, fwdPeriods),     [history.revenue, fwdPeriods]);
  const gpForecast   = useMemo(() => forecastValues(history.grossProfit, fwdPeriods), [history.grossProfit, fwdPeriods]);
  const netForecast  = useMemo(() => forecastValues(history.netIncome, fwdPeriods),   [history.netIncome, fwdPeriods]);
  const alerts       = useMemo(() => detectAlerts(history), [history]);

  // Build last period's date to generate forecast period labels
  const lastPeriod = datasets[datasets.length - 1]?.period ?? "";
  const forecastLabels = useMemo(() => {
    if (!lastPeriod) return [];
    const [y, m] = lastPeriod.split("-").map(Number);
    return Array.from({ length: fwdPeriods }, (_, i) => {
      const d = new Date(y, m + i, 1);
      return formatPeriodAr(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        "monthly"
      );
    });
  }, [lastPeriod, fwdPeriods]);

  // Chart data: historical + forecast combined
  const chartData = useMemo(() => {
    const hist = history.labels.map((label, i) => ({
      label,
      revenue:     history.revenue[i],
      grossProfit: history.grossProfit[i],
      netIncome:   history.netIncome[i],
      type:        "actual" as const,
    }));
    const fwd = forecastLabels.map((label, i) => ({
      label,
      revForecast:  revForecast.values[i],
      gpForecast:   gpForecast.values[i],
      netForecast:  netForecast.values[i],
      type:         "forecast" as const,
    }));
    return [...hist, ...fwd];
  }, [history, forecastLabels, revForecast, gpForecast, netForecast]);

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <BarChart3 size={40} className="text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">لا توجد بيانات مالية محملة</p>
        <p className="text-xs text-muted-foreground">
          قم بتحميل بيانات P&L من{" "}
          <Link href="/pnl-entry" className="text-primary underline">إدخال البيانات</Link>{" "}
          أو{" "}
          <Link href="/pnl-reports" className="text-primary underline">تقارير الشركة</Link>
        </p>
      </div>
    );
  }

  const currency = datasets[0]?.currency ?? "SAR";

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">الشركة</label>
          <div className="relative">
            <select
              value={selectedCompany}
              onChange={(e) => setCompany(e.target.value)}
              className="appearance-none border rounded-lg px-3 py-1.5 pe-7 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {companyNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown size={13} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">فترة التوقع</label>
          <div className="flex rounded-lg border overflow-hidden text-xs">
            {([3, 6, 12] as ForecastPeriods[]).map((p) => (
              <button
                key={p}
                onClick={() => setFwdPeriods(p)}
                className={`px-3 py-1.5 transition-colors ${fwdPeriods === p ? "bg-primary text-white" : "hover:bg-accent"}`}
              >
                {p} أشهر
              </button>
            ))}
          </div>
        </div>
        {datasets.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {datasets.length} فترة تاريخية • <FinancialTooltip term="R²">R²</FinancialTooltip> الإيرادات: {(revForecast.r2 * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* KPI Cards */}
      {agg && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "الإيرادات",         value: agg.revenue,        margin: null,              trend: revForecast.slope },
            { label: "إجمالي الربح",      value: agg.grossProfit,    margin: agg.grossMargin,   trend: gpForecast.slope },
            { label: "الدخل التشغيلي",    value: agg.operatingIncome, margin: agg.operatingMargin, trend: null },
            { label: "صافي الدخل",        value: agg.netIncome,      margin: agg.netMargin,     trend: netForecast.slope },
          ].map((item) => (
            <div key={item.label} className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-lg font-bold leading-tight">{formatNumber(item.value, currency)}</p>
              <div className="flex items-center gap-2 mt-1">
                {item.margin !== null && (
                  <span className="text-xs text-muted-foreground">{item.margin.toFixed(1)}%</span>
                )}
                {item.trend !== null && (
                  <TrendBadge value={item.trend > 0 ? Math.abs(item.trend / Math.max(1, Math.abs(item.value / datasets.length)) * 100) : -(Math.abs(item.trend / Math.max(1, Math.abs(item.value / datasets.length))) * 100)} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-4">الاتجاه والتوقعات</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} width={80} />
              <Tooltip
                formatter={(value: number, name: string) => [formatNumber(value, currency), name]}
                contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {/* Historical */}
              <Line type="monotone" dataKey="revenue"     name="الإيرادات"       stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="grossProfit" name="إجمالي الربح"    stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="netIncome"   name="صافي الدخل"      stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
              {/* Forecast */}
              <Line type="monotone" dataKey="revForecast" name="توقع الإيرادات"  stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
              <Line type="monotone" dataKey="gpForecast"  name="توقع إجمالي الربح" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
              <Line type="monotone" dataKey="netForecast" name="توقع صافي الدخل" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
              {/* Separator line */}
              {history.labels.length > 0 && (
                <ReferenceLine x={history.labels[history.labels.length - 1]} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: "التوقعات ←", position: "top", fontSize: 10 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Forecast Table */}
        {forecastLabels.length > 0 && (
          <div className="bg-card border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">جدول التوقعات الرياضية</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-right pb-2 font-medium text-muted-foreground">الفترة</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">الإيرادات</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">إجمالي الربح</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">صافي الدخل</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastLabels.map((label, i) => (
                    <tr key={label} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground">{label}</td>
                      <td className="py-2 font-medium">{formatNumber(revForecast.values[i], currency)}</td>
                      <td className="py-2">{formatNumber(gpForecast.values[i], currency)}</td>
                      <td className={`py-2 ${netForecast.values[i] < 0 ? "text-red-500" : "text-emerald-600"}`}>
                        {formatNumber(netForecast.values[i], currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
              * مبني على الانحدار الخطي للبيانات التاريخية. دقة التوقع (<FinancialTooltip term="R²">R²</FinancialTooltip>): الإيرادات {(revForecast.r2 * 100).toFixed(0)}%
            </p>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-card border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">التنبيهات المالية</h3>
            <div className="space-y-2">
              {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Analysis Tab ─────────────────────────────────────────────────────────

function AITab() {
  const companies = usePnLStore((s) => s.companies);
  const [company,     setCompany]     = useState<string>("");
  const [promptType,  setPromptType]  = useState<PromptType>("comprehensive");
  const [loading,     setLoading]     = useState(false);
  const [analysis,    setAnalysis]    = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [usedModel,   setUsedModel]   = useState<string | null>(null);

  const companyNames = useMemo(
    () => [...new Set(companies.map((c) => c.companyName))],
    [companies]
  );
  const selectedCompany = company || companyNames[0] || "";

  const datasets = useMemo(
    () =>
      companies
        .filter((c) => c.companyName === selectedCompany)
        .sort((a, b) => a.period.localeCompare(b.period)),
    [companies, selectedCompany]
  );

  const agg    = useMemo(() => datasets.length > 0 ? calculateKPIs(aggregateData(datasets)) : null, [datasets]);
  const currency = datasets[0]?.currency ?? "SAR";

  const periodSummaries = useMemo(() =>
    datasets.map((ds) => {
      const k = calculateKPIs(ds.data);
      return {
        period:         formatPeriodAr(ds.period, "monthly"),
        revenue:        k.revenue,
        grossProfit:    k.grossProfit,
        netIncome:      k.netIncome,
        grossMargin:    k.grossMargin,
        operatingMargin: k.operatingMargin,
      };
    }),
    [datasets]
  );

  async function handleAnalyze() {
    if (!agg) return;
    setLoading(true);
    setAnalysis(null);
    setError(null);
    setUsedModel(null);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: selectedCompany,
          periods: datasets.map((d) => formatPeriodAr(d.period, "monthly")),
          currency,
          promptType,
          kpis: agg,
          periodSummaries,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ في الاتصال");
      } else {
        setAnalysis(data.analysis);
        setUsedModel(data.model);
      }
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <Brain size={40} className="text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">لا توجد بيانات مالية محملة</p>
        <p className="text-xs text-muted-foreground">
          قم بتحميل بيانات P&L من{" "}
          <Link href="/pnl-entry" className="text-primary underline">إدخال البيانات</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Company */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">الشركة</label>
            <div className="relative">
              <select
                value={selectedCompany}
                onChange={(e) => { setCompany(e.target.value); setAnalysis(null); }}
                className="w-full appearance-none border rounded-lg px-3 py-2 pe-7 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {companyNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown size={13} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Prompt type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">نوع التحليل</label>
            <div className="relative">
              <select
                value={promptType}
                onChange={(e) => { setPromptType(e.target.value as PromptType); setAnalysis(null); }}
                className="w-full appearance-none border rounded-lg px-3 py-2 pe-7 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {Object.entries(PROMPT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Summary chips */}
        {agg && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: "إيرادات", value: `${(agg.revenue / 1_000_000).toFixed(1)}م ${currency}` },
              { label: "هامش إجمالي", value: `${agg.grossMargin.toFixed(1)}%` },
              { label: "هامش تشغيلي", value: `${agg.operatingMargin.toFixed(1)}%` },
              { label: "صافي دخل", value: `${(agg.netIncome / 1_000_000).toFixed(1)}م` },
              { label: "فترات", value: `${datasets.length} شهر` },
            ].map((c) => (
              <span key={c.label} className="px-2.5 py-1 rounded-full border text-xs bg-muted/40">
                <span className="text-muted-foreground">{c.label}: </span>
                <span className="font-semibold">{c.value}</span>
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || !agg}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <><Loader2 size={15} className="animate-spin" /> جارٍ التحليل...</>
          ) : (
            <><Sparkles size={15} /> تحليل بالذكاء الاصطناعي</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            {error.includes("مفتاح") && (
              <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-1">
                <Settings size={11} /> الذهاب إلى إعدادات النظام
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="bg-card border rounded-xl p-5 space-y-3 animate-pulse">
          {[80, 60, 90, 50, 70].map((w, i) => (
            <div key={i} className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {/* Result */}
      {analysis && !loading && (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Brain size={15} className="text-primary" />
              {PROMPT_LABELS[promptType]} — {selectedCompany}
            </h3>
            {usedModel && (
              <span className="text-[10px] text-muted-foreground border rounded-full px-2 py-0.5 font-mono">
                {usedModel}
              </span>
            )}
          </div>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 dark:prose-invert">
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AIAnalysisPage() {
  const [activeTab, setActiveTab] = useState<Tab>("forecasts");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles size={22} className="text-primary" />
            رؤى الذكاء المالي
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            تنبؤات رياضية وتحليل ذكي لبياناتك المالية
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "forecasts"}
          onClick={() => setActiveTab("forecasts")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "forecasts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp size={15} />
          التنبؤات الرياضية
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "ai"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain size={15} />
          التحليل الذكي
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "forecasts" ? <ForecastsTab /> : <AITab />}
    </div>
  );
}
