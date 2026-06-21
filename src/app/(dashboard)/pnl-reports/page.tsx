"use client";

import { useEffect, useState, useMemo } from "react";
import { usePnLStore } from "@/store/pnl-store";
import { KPICard } from "@/components/shared/KPICard";
import { PeriodTypeTabs } from "@/components/shared/PeriodTypeTabs";
import { SkeletonKPIBar, SkeletonTable } from "@/components/shared/SkeletonLoaders";
import { PnLTable } from "./PnLTable";
import dynamic from "next/dynamic";
const PnLCharts = dynamic(() => import("./PnLCharts").then((m) => ({ default: m.PnLCharts })), { ssr: false });
import { ExecutiveSummary } from "./ExecutiveSummary";
import { calculateKPIs, groupPeriods, aggregateData, inferDynamic } from "@/lib/pnl-calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CompanyPnL } from "@/lib/pnl-types";
import { FileBarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicCategory } from "@/lib/category-types";

type ReportTab = "pnl" | "executive" | "comparison" | "trend" | "revenue" | "expenses" | "margin" | "variance";
type ComparisonType = "previous_period" | "yoy" | "both";

const REPORT_TABS: { key: ReportTab; label: string; description: string }[] = [
  { key: "pnl",        label: "الأرباح والخسائر",  description: "جدول الأرباح والخسائر التفصيلي مع إمكانية المقارنة بالفترات السابقة" },
  { key: "comparison", label: "مقارنة الفترات",    description: "مقارنة مفصلة بين الفترة الحالية والفترة السابقة أو نفس الفترة من العام الماضي" },
  { key: "trend",      label: "اتجاه الأرباح",     description: "مخطط خطي يتبع تطور الإيرادات والأرباح الرئيسية عبر الفترات الزمنية" },
  { key: "revenue",    label: "تحليل الإيرادات",   description: "تحليل تفصيلي لمصادر الإيرادات ومساهمة كل بند في الإجمالي" },
  { key: "expenses",   label: "تحليل المصروفات",   description: "توزيع المصروفات التشغيلية وتكلفة المبيعات مع مخطط دائري" },
  { key: "margin",     label: "هوامش الربح",       description: "تتبع هوامش الربح الإجمالي والتشغيلي وصافي الربح عبر الفترات" },
  { key: "variance",   label: "تغير الربح",        description: "مقارنة الانحراف في كل بند مالي بين الفترة الحالية والسابقة" },
  { key: "executive",  label: "الملخص التنفيذي",  description: "ملخص تنفيذي شامل بأبرز المؤشرات المالية ونقاط القوة والضعف" },
];

const COMPARISON_OPTIONS: { key: ComparisonType; label: string }[] = [
  { key: "previous_period", label: "الفترة السابقة"              },
  { key: "yoy",             label: "نفس الفترة من العام السابق"  },
  { key: "both",            label: "كلاهما"                      },
];

export default function PnLReportsPage() {
  const {
    companies, loadFromDB,
    periodType, setPeriodType,
  } = usePnLStore();

  const [loading, setLoading]               = useState(true);
  const [categories, setCategories]         = useState<DynamicCategory[]>([]);
  const [activeTab, setActiveTab]           = useState<ReportTab>("pnl");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>("");
  const [comparisonType, setComparisonType] = useState<ComparisonType>("previous_period");
  const [activeFiscalYear, setActiveFiscalYear] = useState<string | null>(null);

  // ── Load from API (replace store, no merge) ───────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [pnlRes, jeRes, catsRes] = await Promise.all([
        fetch("/api/pnl/save-batch"),
        fetch("/api/journal-entries"),
        fetch("/api/categories"),
      ]);
      const { datasets } = await pnlRes.json();
      const { entries }  = await jeRes.json();
      const { categories: cats } = await catsRes.json();
      setCategories(cats ?? []);

      const mapped: CompanyPnL[] = datasets.map((d: {
        id: string; companyId: string; companyName: string;
        period: string; currency: string;
        parsed: { lineItems: { key: string; amount: number }[] };
      }) => ({
        id: d.id,
        companyId: d.companyId,
        companyName: d.companyName,
        period: d.period,
        currency: d.currency,
        data: Object.fromEntries(d.parsed.lineItems.map((li) => [li.key, li.amount])),
      }));

      loadFromDB(mapped, entries);   // يبدّل البيانات بدلاً من الدمج
      setLoading(false);
    }
    load();
  }, []);

  // ── Company list ──────────────────────────────────────────────────────────
  const availableCompanies = useMemo(() => {
    const names = [...new Set(companies.map((c) => c.companyName))];
    return names.map((name) => ({ name, id: companies.find((co) => co.companyName === name)?.companyId ?? name }));
  }, [companies]);

  useEffect(() => {
    if (availableCompanies.length > 0 && !selectedCompany) {
      setSelectedCompany(availableCompanies[0].name);
    }
  }, [availableCompanies]);

  const companyDatasets = useMemo(
    () => companies.filter((c) => c.companyName === selectedCompany),
    [companies, selectedCompany]
  );

  // ── Period groups ─────────────────────────────────────────────────────────
  const allPeriodGroups = useMemo(() => {
    const months = companyDatasets.map((c) => c.period);
    return groupPeriods(months, periodType);
  }, [companyDatasets, periodType]);

  // السنوات المتاحة للشركة المختارة
  const availableYears = useMemo(() => {
    const years = [...new Set(companyDatasets.map((c) => c.period.slice(0, 4)))].sort();
    return years;
  }, [companyDatasets]);

  // تحديد السنة تلقائياً عند تغيير الشركة
  useEffect(() => {
    if (availableYears.length > 0 && (!activeFiscalYear || !availableYears.includes(activeFiscalYear))) {
      setActiveFiscalYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears]);

  // الفترات مفلترة حسب السنة المالية المختارة
  const periodGroups = useMemo(() => {
    if (!activeFiscalYear) return allPeriodGroups;
    return allPeriodGroups.filter((g) => g.months.some((m) => m.startsWith(activeFiscalYear)));
  }, [allPeriodGroups, activeFiscalYear]);

  // Auto-select latest period
  useEffect(() => {
    if (periodGroups.length > 0) {
      const exists = periodGroups.find((g) => g.key === selectedPeriodKey);
      if (!exists) setSelectedPeriodKey(periodGroups[periodGroups.length - 1].key);
    }
  }, [periodGroups]);

  const selectedGroup = periodGroups.find((g) => g.key === selectedPeriodKey);

  const selectedData = useMemo(() => {
    if (!selectedGroup) return {};
    const ds = companyDatasets.filter((c) => selectedGroup.months.includes(c.period));
    return inferDynamic(aggregateData(ds), categories);
  }, [selectedGroup, companyDatasets, categories]);

  const kpis = useMemo(() => calculateKPIs(selectedData), [selectedData]);

  const selectedGroupIndex = periodGroups.findIndex((g) => g.key === selectedPeriodKey);
  // البحث في allPeriodGroups (غير المُصفَّاة) لإيجاد الفترة السابقة عبر حدود السنة المالية
  const selectedGroupIndexInAll = allPeriodGroups.findIndex((g) => g.key === selectedPeriodKey);
  const prevGroup = allPeriodGroups[selectedGroupIndexInAll - 1];

  // الفترة السابقة (sequential)
  const prevPeriodData = useMemo(() => {
    if (!prevGroup) return null;
    const ds = companyDatasets.filter((c) => prevGroup.months.includes(c.period));
    return ds.length > 0 ? inferDynamic(aggregateData(ds), categories) : null;
  }, [prevGroup, companyDatasets, categories]);

  // نفس الفترة من السنة الماضية (YoY)
  const yoyData = useMemo(() => {
    if (!selectedGroup) return null;
    const yoyMonths = selectedGroup.months.map((m) => {
      const [y, mo] = m.split("-");
      return `${+y - 1}-${mo}`;
    });
    const ds = companyDatasets.filter((c) => yoyMonths.includes(c.period));
    return ds.length > 0 ? inferDynamic(aggregateData(ds), categories) : null;
  }, [selectedGroup, companyDatasets, categories]);

  // prevData للـ PnLTable والمخططات
  const prevData = useMemo(
    () => (comparisonType === "yoy" ? yoyData : prevPeriodData),
    [comparisonType, prevPeriodData, yoyData]
  );

  const prevPeriodLabel = prevGroup?.labelAr ?? null;
  const yoyLabel = useMemo(
    () => selectedGroup ? selectedGroup.labelAr.replace(/\d{4}/, (y) => String(+y - 1)) : null,
    [selectedGroup]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonKPIBar />
        <SkeletonTable rows={12} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3 pb-1 border-b-2 border-primary/30">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileBarChart2 size={20} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">تحليل الأرباح والخسائر</h1>
      </div>

      {/* ── شريط الفلاتر الموحد ── */}
      <div className="bg-card rounded-xl border border-l-0 border-r-4 border-r-primary/60 p-4 space-y-3 shadow-sm">

        {/* ── صف 1: اختيار الشركة ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">الشركة</span>
          <div className="w-px h-4 bg-border" />
          {availableCompanies.length === 0 ? (
            <span className="text-sm text-muted-foreground">لا توجد شركات</span>
          ) : (
            availableCompanies.map((c) => (
              <button
                key={c.name}
                onClick={() => { setSelectedCompany(c.name); setSelectedPeriodKey(""); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                  selectedCompany === c.name
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted border-transparent"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", selectedCompany === c.name ? "bg-white" : "bg-primary/60")} />
                {c.name}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-dashed" />

        {/* ── صف 2: نوع الفترة + السنة المالية + الفترة ── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* نوع الفترة */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">نوع الفترة</span>
            <div className="w-px h-4 bg-border" />
            <PeriodTypeTabs value={periodType} onChange={(t) => { setPeriodType(t); setSelectedPeriodKey(""); }} />
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* السنة المالية */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">السنة المالية</span>
              <div className="w-px h-4 bg-border" />
              <select
                value={activeFiscalYear ?? ""}
                onChange={(e) => { setActiveFiscalYear(e.target.value || null); setSelectedPeriodKey(""); }}
                className="text-sm border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">كل السنوات</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* اختيار الفترة: يعرض التسمية الكاملة حسب نوع الفترة */}
          {periodGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-10">الفترة</span>
              <div className="w-px h-4 bg-border" />
              <select
                value={selectedPeriodKey}
                onChange={(e) => setSelectedPeriodKey(e.target.value)}
                className="text-sm border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-[160px]"
              >
                {periodGroups.map((g) => (
                  <option key={g.key} value={g.key}>{g.labelAr}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="border-t border-dashed" />

        {/* ── صف 3: نوع المقارنة ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">المقارنة</span>
          <div className="w-px h-4 bg-border" />
          {COMPARISON_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setComparisonType(opt.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm border font-medium transition-all",
                comparisonType === opt.key
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── بطاقات KPI ── */}
      {selectedGroup && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard title="الإيرادات"           value={formatCurrency(kpis.revenue,         "SAR", true)} colorVariant="blue"                                              />
          <KPICard title="هامش الربح الإجمالي" value={formatCurrency(kpis.grossProfit,     "SAR", true)} subtitle={formatPercent(kpis.grossMargin)}    colorVariant="emerald" />
          <KPICard title="EBITDA"               value={formatCurrency(kpis.ebitda,          "SAR", true)} subtitle={formatPercent(kpis.ebitdaMargin)}   colorVariant="teal"    />
          <KPICard title="الهامش التشغيلي"      value={formatCurrency(kpis.operatingIncome, "SAR", true)} subtitle={formatPercent(kpis.operatingMargin)} colorVariant="cyan"    />
          <KPICard
            title="صافي الربح"
            value={formatCurrency(kpis.netIncome, "SAR", true)}
            subtitle={formatPercent(kpis.netMargin)}
            colorVariant={kpis.netIncome >= 0 ? "emerald" : "amber"}
          />
        </div>
      )}

      {/* ── تبويبات التقارير ── */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all rounded-t-md",
              activeTab === tab.key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── وصف التبويب النشط ── */}
      {(() => {
        const desc = REPORT_TABS.find(t => t.key === activeTab)?.description;
        return desc ? (
          <p className="text-xs text-muted-foreground px-1 -mt-2">{desc}</p>
        ) : null;
      })()}

      {/* ── محتوى التبويب ── */}
      <div className="space-y-4 fade-in">
        {activeTab === "pnl" && (
          <>
            <PnLCharts data={selectedData} prevData={prevData} datasets={companyDatasets} periodGroups={periodGroups} chartType="waterfall" currency="SAR" />
            <PnLTable
              data={selectedData}
              prevData={comparisonType === "yoy" ? yoyData : prevPeriodData}
              prevLabel={comparisonType === "yoy" ? yoyLabel : prevPeriodLabel}
              prevData2={comparisonType === "both" ? yoyData : null}
              prevLabel2={comparisonType === "both" ? yoyLabel : null}
              currency="SAR"
              companyName={selectedCompany}
              period={selectedPeriodKey}
              periodMonths={selectedGroup?.months ?? [selectedPeriodKey]}
              categories={categories}
            />
          </>
        )}
        {activeTab === "comparison" && (
          <>
            <PnLCharts data={selectedData} prevData={prevData} datasets={companyDatasets} periodGroups={periodGroups} chartType="column" currency="SAR" />
            <ComparisonTab
              selectedData={selectedData}
              selectedLabel={selectedGroup?.labelAr ?? selectedPeriodKey}
              prevPeriodData={prevPeriodData}
              prevPeriodLabel={prevPeriodLabel}
              yoyData={yoyData}
              yoyLabel={yoyLabel}
              comparisonType={comparisonType}
            />
          </>
        )}
        {activeTab === "trend" && (
          <>
            <PnLCharts data={selectedData} prevData={prevData} datasets={companyDatasets} periodGroups={periodGroups} chartType="line" currency="SAR" />
            <TrendTab datasets={companyDatasets} periodGroups={periodGroups} mode="trend" categories={categories} />
          </>
        )}
        {activeTab === "revenue" && (
          <>
            <PnLCharts data={selectedData} prevData={prevData} datasets={companyDatasets} periodGroups={periodGroups} chartType="area" currency="SAR" />
            <TrendTab datasets={companyDatasets} periodGroups={periodGroups} mode="revenue" categories={categories} />
          </>
        )}
        {activeTab === "expenses" && (
          <>
            <PnLCharts data={selectedData} prevData={prevData} datasets={companyDatasets} periodGroups={periodGroups} chartType="pie" currency="SAR" />
            <TrendTab datasets={companyDatasets} periodGroups={periodGroups} mode="expenses" categories={categories} />
          </>
        )}
        {activeTab === "margin" && (
          <>
            <PnLCharts data={selectedData} prevData={prevData} datasets={companyDatasets} periodGroups={periodGroups} chartType="margin" currency="SAR" />
            <TrendTab datasets={companyDatasets} periodGroups={periodGroups} mode="margin" categories={categories} />
          </>
        )}
        {activeTab === "variance" && (
          <>
            <PnLCharts data={selectedData} prevData={prevData} datasets={companyDatasets} periodGroups={periodGroups} chartType="variance" currency="SAR" />
            <TrendTab datasets={companyDatasets} periodGroups={periodGroups} mode="variance" categories={categories} />
          </>
        )}
        {activeTab === "executive" && (
          <ExecutiveSummary data={selectedData} kpis={kpis} currency="SAR" />
        )}
      </div>

    </div>
  );
}

// ─── مساعد نسبة التغيير ──────────────────────────────────────────────────────
function ChangeCell({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">—</td>;
  if (previous === 0) return <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">—</td>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const up  = pct >= 0;
  return (
    <td className={cn("px-4 py-2.5 text-center text-sm font-semibold", up ? "text-emerald-600" : "text-red-500")}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </td>
  );
}

// ─── تبويب مقارنة الفترات ────────────────────────────────────────────────────
function ComparisonTab({
  selectedData, selectedLabel,
  prevPeriodData, prevPeriodLabel,
  yoyData, yoyLabel,
  comparisonType,
}: {
  selectedData: Record<string, number>;
  selectedLabel: string;
  prevPeriodData: Record<string, number> | null;
  prevPeriodLabel: string | null;
  yoyData: Record<string, number> | null;
  yoyLabel: string | null;
  comparisonType: ComparisonType;
}) {
  const showPrev = comparisonType === "previous_period" || comparisonType === "both";
  const showYoy  = comparisonType === "yoy"             || comparisonType === "both";

  const ROWS = [
    { key: "revenue",                label: "الإيرادات",                  positive: true  },
    { key: "gross_profit",           label: "إجمالي الربح",               positive: true  },
    { key: "operating_income",       label: "الدخل التشغيلي",             positive: true  },
    { key: "net_income",             label: "صافي الدخل",                 positive: true  },
    { key: "cost_of_goods_sold",     label: "تكلفة البضاعة المباعة",       positive: false },
    { key: "selling_expenses",       label: "مصروفات البيع",              positive: false },
    { key: "general_admin_expenses", label: "مصروفات الإدارة العمومية",   positive: false },
  ];

  const revenue     = selectedData["revenue"]          ?? 0;
  const prevRevenue = prevPeriodData?.["revenue"]       ?? 0;
  const yoyRevenue  = yoyData?.["revenue"]              ?? 0;

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary/10 border-b">
            <th className="text-right px-4 py-3 font-semibold min-w-[180px]">البند</th>
            <th className="text-left px-4 py-3 font-semibold text-primary">{selectedLabel}</th>
            {showPrev && prevPeriodData && (
              <>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{prevPeriodLabel}</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">تغيير %</th>
              </>
            )}
            {showYoy && yoyData && (
              <>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{yoyLabel}</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground text-xs">تغيير سنوي %</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => {
            const curr = selectedData[row.key] ?? 0;
            const prev = prevPeriodData?.[row.key];
            const yoy  = yoyData?.[row.key];
            const color = row.positive
              ? curr >= 0 ? "text-emerald-600" : "text-red-500"
              : "text-red-500";

            return (
              <tr key={row.key} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                <td className="px-4 py-2.5 font-medium">{row.label}</td>
                <td className={cn("px-4 py-2.5 text-left font-mono font-semibold", color)}>
                  {formatCurrency(curr, "SAR", true)}
                  {revenue > 0 && row.key !== "revenue" && (
                    <span className="text-xs text-muted-foreground ms-2">({((curr / revenue) * 100).toFixed(1)}%)</span>
                  )}
                </td>
                {showPrev && prevPeriodData && (
                  <>
                    <td className="px-4 py-2.5 text-left font-mono text-muted-foreground">
                      {prev !== undefined ? formatCurrency(prev, "SAR", true) : "—"}
                      {prevRevenue > 0 && row.key !== "revenue" && prev !== undefined && (
                        <span className="text-xs ms-1">({((prev / prevRevenue) * 100).toFixed(1)}%)</span>
                      )}
                    </td>
                    <ChangeCell current={curr} previous={prev} />
                  </>
                )}
                {showYoy && yoyData && (
                  <>
                    <td className="px-4 py-2.5 text-left font-mono text-muted-foreground">
                      {yoy !== undefined ? formatCurrency(yoy, "SAR", true) : "—"}
                      {yoyRevenue > 0 && row.key !== "revenue" && yoy !== undefined && (
                        <span className="text-xs ms-1">({((yoy / yoyRevenue) * 100).toFixed(1)}%)</span>
                      )}
                    </td>
                    <ChangeCell current={curr} previous={yoy} />
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── تبويب الاتجاه والتحليل ──────────────────────────────────────────────────
function TrendTab({
  datasets,
  periodGroups,
  mode,
  categories,
}: {
  datasets: CompanyPnL[];
  periodGroups: ReturnType<typeof groupPeriods>;
  mode: string;
  categories: DynamicCategory[];
}) {
  const periodsData = periodGroups.map((g) => {
    const ds   = datasets.filter((c) => g.months.includes(c.period));
    const data = inferDynamic(aggregateData(ds), categories);
    const kpis = calculateKPIs(data);
    return { label: g.labelAr, data, kpis };
  });

  if (mode === "revenue") {
    const max = Math.max(...periodsData.map((p) => p.data["revenue"] ?? 0), 1);
    return (
      <div className="rounded-xl border bg-card p-4 space-y-2 shadow-sm">
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">الإيرادات عبر الفترات</h3>
        {periodsData.map((p) => {
          const rev = p.data["revenue"] ?? 0;
          return (
            <div key={p.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-right">{p.label}</span>
              <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(rev / max) * 100}%` }} />
              </div>
              <span className="w-28 text-left text-sm font-mono">{formatCurrency(rev, "SAR", true)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === "expenses") {
    const expKeys = [
      { key: "cost_of_goods_sold",      label: "تكلفة البضاعة المباعة" },
      { key: "selling_expenses",         label: "مصروفات البيع"         },
      { key: "general_admin_expenses",   label: "مصروفات الإدارة"       },
      { key: "depreciation_amortization",label: "الاستهلاك والإطفاء"    },
    ];
    return (
      <div className="rounded-xl border overflow-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/10 border-b">
              <th className="text-right px-4 py-3 font-semibold">بند المصروف</th>
              {periodsData.map((p) => (
                <th key={p.label} className="text-left px-4 py-3 font-semibold">{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expKeys.map((ek, i) => (
              <tr key={ek.key} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                <td className="px-4 py-2.5 font-medium">{ek.label}</td>
                {periodsData.map((p) => (
                  <td key={p.label} className="px-4 py-2.5 text-left font-mono text-red-500">
                    {formatCurrency(p.data[ek.key] ?? 0, "SAR", true)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const columns: { key: string; label: string }[] =
    mode === "margin"
      ? [
          { key: "grossMargin",     label: "هامش إجمالي %"    },
          { key: "operatingMargin", label: "هامش تشغيلي %"    },
          { key: "netMargin",       label: "هامش صافي %"      },
        ]
      : [
          { key: "revenue",          label: "الإيرادات"         },
          { key: "gross_profit",     label: "إجمالي الربح"      },
          { key: "operating_income", label: "الدخل التشغيلي"    },
          { key: "net_income",       label: "صافي الدخل"        },
        ];

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary/10 border-b">
            <th className="text-right px-4 py-3 font-semibold">الفترة</th>
            {columns.map((c) => (
              <th key={c.key} className="text-left px-4 py-3 font-semibold">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periodsData.map((p, i) => (
            <tr key={p.label} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5 font-medium">{p.label}</td>
              {columns.map((c) => {
                const isMargin = mode === "margin";
                const val = isMargin
                  ? (p.kpis as unknown as Record<string, number>)[c.key] ?? 0
                  : p.data[c.key] ?? 0;
                return (
                  <td key={c.key} className={cn("px-4 py-2.5 text-left font-mono", val >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {isMargin ? formatPercent(val) : formatCurrency(val, "SAR", true)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
