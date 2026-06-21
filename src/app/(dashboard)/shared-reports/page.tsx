"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePnLStore } from "@/store/pnl-store";
import { PeriodTypeTabs } from "@/components/shared/PeriodTypeTabs";
import { ROW_STYLES, buildTree } from "../pnl-reports/PnLTable";
import { calculateKPIs, groupPeriods, aggregateData, inferDynamic } from "@/lib/pnl-calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CompanyPnL, PnLKPIs, PeriodGroup } from "@/lib/pnl-types";
import { KPICard } from "@/components/shared/KPICard";
import { SkeletonKPIBar, SkeletonTable } from "@/components/shared/SkeletonLoaders";
import dynamic from "next/dynamic";
import type { HoldingChartType } from "./HoldingCharts";
const HoldingCharts = dynamic(() => import("./HoldingCharts").then((m) => ({ default: m.HoldingCharts })), { ssr: false });
import { Building2, ChevronDown, ChevronLeft, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicCategory, catKey, FORMULA_KEYS } from "@/lib/category-types";

type MultiReport =
  | "consolidated"
  | "comparison"
  | "profitability"
  | "ranking"
  | "contribution"
  | "revenue_comparison"
  | "expense_comparison"
  | "margin_comparison"
  | "variance"
  | "group_trend";

const REPORT_TABS: { key: MultiReport; label: string; description: string }[] = [
  { key: "consolidated",       label: "تقرير الأرباح والخسائر الموحد",           description: "جدول أرباح وخسائر موحد يجمع بيانات جميع الشركات المختارة" },
  { key: "comparison",         label: "تقرير مقارنة الأرباح بين الشركات",       description: "مقارنة صافي ربح كل شركة في الفترة المختارة بمخطط أعمدة" },
  { key: "profitability",      label: "تقرير ربحية الشركات",                    description: "منحنى ربحية الشركات عبر الفترات الزمنية المتعاقبة" },
  { key: "ranking",            label: "تقرير ترتيب الشركات حسب الربح",          description: "ترتيب الشركات تنازلياً حسب صافي الربح في الفترة المختارة" },
  { key: "contribution",       label: "تقرير مساهمة الشركات في أرباح المجموعة", description: "نسبة مساهمة كل شركة في إجمالي أرباح المجموعة بمخطط دائري" },
  { key: "revenue_comparison", label: "تقرير مقارنة الإيرادات بين الشركات",     description: "مقارنة إيرادات الشركات جنباً إلى جنب عبر الفترات" },
  { key: "expense_comparison", label: "تقرير مقارنة المصروفات بين الشركات",     description: "مقارنة مصروفات الشركات في صورة خريطة حرارية" },
  { key: "margin_comparison",  label: "تقرير مقارنة هامش الربح بين الشركات",    description: "مقارنة هوامش الربح بين الشركات لقياس الكفاءة التشغيلية" },
  { key: "variance",           label: "تقرير تغيرات الأرباح بين الفترات",       description: "تحليل التغيرات في أرباح كل شركة بين فترتين متتاليتين" },
  { key: "group_trend",        label: "تقرير اتجاه أداء المجموعة",              description: "اتجاه نمو إيرادات وأرباح المجموعة على مدار جميع الفترات" },
];

const REPORT_CHART: Partial<Record<MultiReport, HoldingChartType>> = {
  consolidated:       "waterfall_consolidated",
  comparison:         "profit_bar",
  profitability:      "trend_line",
  ranking:            "ranking",
  contribution:       "pie_contribution",
  revenue_comparison: "rev_exp",
  expense_comparison: "heatmap",
  margin_comparison:  "margin_comparison",
  variance:           "period_column",
  group_trend:        "growth",
};

const COLORS = ["#0d9488", "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308", "#10b981", "#06b6d4"];

export type CompanyPeriodData = {
  name: string;
  data: Record<string, number>;
  kpis: PnLKPIs;
  color: string;
};

type PeriodSnapshot = {
  group: PeriodGroup;
  byCompany: CompanyPeriodData[];
  consolidatedData: Record<string, number>;
  consolidatedKpis: PnLKPIs;
};

export default function SharedReportsPage() {
  const { companies, addCompanies, periodType, setPeriodType } = usePnLStore();

  const [loading, setLoading]               = useState(true);
  const [categories, setCategories]         = useState<DynamicCategory[]>([]);
  const [activeReport, setActiveReport]     = useState<MultiReport>("consolidated");
  const [selectedCompanyNames, setSelectedCompanyNames] = useState<string[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear]     = useState<string>("");
  const [multiJournalModal, setMultiJournalModal]       = useState<{ key: string; nameAr: string; periods: string[] } | null>(null);
  const [selectedPeriodKey, setSelectedPeriodKey]       = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/pnl/save-batch").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([{ datasets }, { categories: cats }]) => {
      const mapped: CompanyPnL[] = datasets.map((d: {
        id: string; companyId: string; companyName: string;
        period: string; currency: string;
        parsed: { lineItems: { key: string; amount: number }[] };
      }) => ({
        id: d.id, companyId: d.companyId, companyName: d.companyName,
        period: d.period, currency: d.currency,
        data: Object.fromEntries(d.parsed.lineItems.map((li) => [li.key, li.amount])),
      }));
      addCompanies(mapped);
      setCategories(cats ?? []);
      setLoading(false);
    });
  }, []);

  const availableCompanies = useMemo(() => {
    const names = [...new Set(companies.map((c) => c.companyName))];
    return names.map((name, i) => ({ name, color: COLORS[i % COLORS.length] }));
  }, [companies]);

  useEffect(() => {
    if (availableCompanies.length > 0 && selectedCompanyNames.length === 0) {
      setSelectedCompanyNames(availableCompanies.map((c) => c.name));
    }
  }, [availableCompanies]);

  const filteredCompanies = useMemo(
    () => companies.filter((c) => selectedCompanyNames.includes(c.companyName)),
    [companies, selectedCompanyNames]
  );

  const availableYears = useMemo(
    () => [...new Set(companies.map((c) => c.period.slice(0, 4)))].sort(),
    [companies]
  );

  const allPeriods = useMemo(
    () => [...new Set(filteredCompanies.map((c) => c.period))].sort(),
    [filteredCompanies]
  );

  const allPeriodGroups = useMemo(
    () => groupPeriods(allPeriods, periodType),
    [allPeriods, periodType]
  );

  const periodGroups = useMemo(() => {
    if (!selectedFiscalYear) return allPeriodGroups;
    return allPeriodGroups.filter((g) => g.months.some((m) => m.startsWith(selectedFiscalYear)));
  }, [allPeriodGroups, selectedFiscalYear]);

  // بيانات جميع الفترات مجمّعة (inferDynamic يحسب الأبناء والمعادلات)
  const allPeriodsData = useMemo<PeriodSnapshot[]>(() => {
    return periodGroups.map((g) => {
      const byCompany: CompanyPeriodData[] = selectedCompanyNames.map((name) => {
        const ds = companies.filter(
          (c) => c.companyName === name && g.months.includes(c.period)
        );
        const data = inferDynamic(aggregateData(ds), categories);
        return {
          name,
          data,
          kpis: calculateKPIs(data),
          color: availableCompanies.find((c) => c.name === name)?.color ?? COLORS[0],
        };
      });
      const allDs = companies.filter(
        (c) => selectedCompanyNames.includes(c.companyName) && g.months.includes(c.period)
      );
      const consolidatedData = inferDynamic(aggregateData(allDs), categories);
      return { group: g, byCompany, consolidatedData, consolidatedKpis: calculateKPIs(consolidatedData) };
    });
  }, [periodGroups, companies, selectedCompanyNames, availableCompanies, categories]);

  const latestPeriod = allPeriodsData.at(-1);

  const displayedPeriodsData = useMemo(
    () => selectedPeriodKey
      ? allPeriodsData.filter((s) => s.group.key === selectedPeriodKey)
      : allPeriodsData,
    [allPeriodsData, selectedPeriodKey]
  );

  const toggleAllCompanies = () => {
    if (selectedCompanyNames.length === availableCompanies.length) {
      setSelectedCompanyNames([]);
    } else {
      setSelectedCompanyNames(availableCompanies.map((c) => c.name));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonKPIBar />
        <SkeletonTable rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3 pb-1 border-b-2 border-primary/30">
        <div className="p-2 rounded-lg bg-primary/10">
          <Building2 size={20} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">تحليل الأرباح والخسائر — الشركة القابضة</h1>
      </div>

      {/* ── شريط الفلاتر الموحد ── */}
      <div className="bg-card rounded-xl border border-l-0 border-r-4 border-r-primary/60 p-4 space-y-3 shadow-sm">

        {/* صف 1: اختيار الشركات */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">الشركات</span>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={toggleAllCompanies}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
              selectedCompanyNames.length === availableCompanies.length
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted border-transparent"
            )}
          >
            الكل
          </button>
          {availableCompanies.map((c) => (
            <button
              key={c.name}
              onClick={() =>
                setSelectedCompanyNames((prev) =>
                  prev.includes(c.name) ? prev.filter((n) => n !== c.name) : [...prev, c.name]
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
              style={
                selectedCompanyNames.includes(c.name)
                  ? { backgroundColor: c.color, borderColor: c.color, color: "#fff" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>

        <div className="border-t border-dashed" />

        {/* صف 2: نوع الفترة + السنة المالية */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">نوع الفترة</span>
            <div className="w-px h-4 bg-border" />
            <PeriodTypeTabs value={periodType} onChange={setPeriodType} />
          </div>
          {availableYears.length > 0 && (
            <>
              <div className="h-5 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">السنة المالية</span>
                <div className="w-px h-4 bg-border" />
                <select
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(e.target.value)}
                  className="text-sm border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">كل السنوات</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {periodGroups.length > 0 && (
          <>
            <div className="border-t border-dashed" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap w-20">الفترة</span>
              <div className="w-px h-4 bg-border" />
              <select
                value={selectedPeriodKey}
                onChange={(e) => setSelectedPeriodKey(e.target.value)}
                className="text-sm border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">كل الفترات</option>
                {periodGroups.map((g) => (
                  <option key={g.key} value={g.key}>{g.labelAr}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* ── بطاقات KPI — آخر فترة ── */}
      {latestPeriod && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard title="الإيرادات الموحدة" value={formatCurrency(latestPeriod.consolidatedKpis.revenue, "SAR", true)} colorVariant="blue" />
          <KPICard
            title="إجمالي الربح"
            value={formatCurrency(latestPeriod.consolidatedKpis.grossProfit, "SAR", true)}
            subtitle={formatPercent(latestPeriod.consolidatedKpis.grossMargin)}
            colorVariant="emerald"
          />
          <KPICard
            title="EBITDA"
            value={formatCurrency(latestPeriod.consolidatedKpis.ebitda, "SAR", true)}
            subtitle={formatPercent(latestPeriod.consolidatedKpis.ebitdaMargin)}
            colorVariant="teal"
          />
          <KPICard
            title="الدخل التشغيلي"
            value={formatCurrency(latestPeriod.consolidatedKpis.operatingIncome, "SAR", true)}
            subtitle={formatPercent(latestPeriod.consolidatedKpis.operatingMargin)}
            colorVariant="cyan"
          />
          <KPICard
            title="صافي الربح الموحد"
            value={formatCurrency(latestPeriod.consolidatedKpis.netIncome, "SAR", true)}
            subtitle={formatPercent(latestPeriod.consolidatedKpis.netMargin)}
            colorVariant={latestPeriod.consolidatedKpis.netIncome >= 0 ? "emerald" : "amber"}
          />
        </div>
      )}

      {/* ── تبويبات التقارير ── */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveReport(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all rounded-t-md",
              activeReport === tab.key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── وصف التقرير النشط ── */}
      {(() => {
        const desc = REPORT_TABS.find(t => t.key === activeReport)?.description;
        return desc ? (
          <p className="text-xs text-muted-foreground px-1 -mt-2">{desc}</p>
        ) : null;
      })()}

      <div className="fade-in space-y-4">
        {activeReport === "consolidated" && (
          <>
            <MultiCompanyPnLTable
              allPeriodsData={displayedPeriodsData}
              categories={categories}
              onAccountClick={(key, nameAr, periods) =>
                setMultiJournalModal({ key, nameAr, periods })
              }
            />
            {multiJournalModal && (
              <MultiCompanyJournalModal
                accountKey={multiJournalModal.key}
                accountNameAr={multiJournalModal.nameAr}
                periods={multiJournalModal.periods}
                companies={availableCompanies.filter((c) => selectedCompanyNames.includes(c.name))}
                onClose={() => setMultiJournalModal(null)}
              />
            )}
          </>
        )}
        {activeReport === "comparison"         && <CompanyComparisonReport allPeriodsData={displayedPeriodsData} />}
        {activeReport === "profitability"       && <ProfitabilityReport     allPeriodsData={displayedPeriodsData} />}
        {activeReport === "ranking"             && <RankingReport           periodDataByCompany={latestPeriod?.byCompany ?? []} />}
        {activeReport === "contribution"        && <ContributionReport      periodDataByCompany={latestPeriod?.byCompany ?? []} />}
        {activeReport === "revenue_comparison"  && <RevenueComparisonReport allPeriodsData={displayedPeriodsData} />}
        {activeReport === "expense_comparison"  && <ExpenseComparisonReport allPeriodsData={displayedPeriodsData} />}
        {activeReport === "margin_comparison"   && <MarginComparisonReport  allPeriodsData={displayedPeriodsData} />}
        {activeReport === "variance"            && <VarianceReport          allPeriodsData={displayedPeriodsData} />}
        {activeReport === "group_trend"         && <GroupTrendReport        allPeriodsData={displayedPeriodsData} />}

        {REPORT_CHART[activeReport] && (
          <HoldingCharts
            periodDataByCompany={latestPeriod?.byCompany ?? []}
            prevPeriodDataByCompany={null}
            consolidatedData={latestPeriod?.consolidatedData ?? {}}
            periodGroups={periodGroups}
            allCompanyDatasets={filteredCompanies}
            selectedCompanyNames={selectedCompanyNames}
            chartType={REPORT_CHART[activeReport]!}
            currency="SAR"
          />
        )}
      </div>
    </div>
  );
}

// ─── جدول الأرباح والخسائر متعدد الشركات ─────────────────────────────────────

function MultiCompanyPnLTable({
  allPeriodsData,
  categories,
  onAccountClick,
}: {
  allPeriodsData: PeriodSnapshot[];
  categories: DynamicCategory[];
  onAccountClick?: (key: string, nameAr: string, periods: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    categories.forEach((c) => { if (c.isTotal || FORMULA_KEYS.has(c.pnlKey ?? "")) init[c.id] = true; });
    return init;
  });

  const roots = useMemo(() => buildTree(categories), [categories]);
  const companies = allPeriodsData[0]?.byCompany ?? [];
  const allMonths = useMemo(
    () => [...new Set(allPeriodsData.flatMap((s) => s.group.months))],
    [allPeriodsData]
  );

  function toggle(id: string) { setExpanded((prev) => ({ ...prev, [id]: !prev[id] })); }

  function renderNode(cat: DynamicCategory, depth = 0): React.ReactNode {
    const key = catKey(cat);
    const hasChildren = cat.children.length > 0;
    const isExpanded = expanded[cat.id] ?? false;
    const rowStyle = ROW_STYLES[cat.pnlKey ?? ""] ?? "";
    const isFormula = FORMULA_KEYS.has(cat.pnlKey ?? "");

    return [
      <tr
        key={cat.id}
        className={cn("border-b last:border-0 transition-colors", rowStyle || (depth === 0 ? "" : "hover:bg-muted/30"))}
      >
        <td
          className="px-4 py-2.5 cursor-pointer"
          style={{ paddingRight: `${(depth + 1) * 16}px` }}
          onClick={() => {
            if (hasChildren) toggle(cat.id);
            else if (!isFormula && onAccountClick) onAccountClick(key, cat.nameAr, allMonths);
          }}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <span className="text-muted-foreground">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
              </span>
            )}
            <span className={cn(depth === 0 || cat.isTotal || cat.isSubtotal ? "font-semibold" : "")}>
              {cat.nameAr}
            </span>
          </div>
        </td>
        {allPeriodsData.map((snap, pi) => {
          const consVal     = snap.consolidatedData[key] ?? 0;
          const nextConsVal = allPeriodsData[pi + 1]?.consolidatedData[key] ?? null;
          return [
            ...companies.map((c) => {
              const val = snap.byCompany.find((b) => b.name === c.name)?.data[key] ?? 0;
              return (
                <td
                  key={`${snap.group.key}-${c.name}`}
                  className={cn(
                    "px-3 py-2.5 text-left font-mono text-xs border-l",
                    val < 0 ? "text-red-500" : cat.type === "profit" ? (val >= 0 ? "text-emerald-600" : "text-red-500") : ""
                  )}
                >
                  {val !== 0 ? formatCurrency(val, "SAR", false) : "—"}
                </td>
              );
            }),
            nextConsVal !== null && <PctTd key={`pct-${pi}`} curr={nextConsVal} prev={consVal} />,
          ];
        })}
      </tr>,
      ...(hasChildren && isExpanded ? cat.children.map((child) => renderNode(child, depth + 1)) : []),
    ];
  }

  if (allPeriodsData.length === 0) return <EmptyState />;

  return (
    <div className="rounded-xl border overflow-auto shadow-sm print-full">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold min-w-[220px]" rowSpan={2}>البند</th>
            {allPeriodsData.map((snap, i) => [
              <th key={snap.group.key} className="text-center px-3 py-3 font-semibold whitespace-nowrap border-l" colSpan={companies.length}>
                {snap.group.labelAr}
              </th>,
              i < allPeriodsData.length - 1 && (
                <th key={`pct-h-${i}`} className="text-center px-2 py-3 text-xs text-muted-foreground bg-muted/20 border-l" rowSpan={2}>%</th>
              ),
            ])}
          </tr>
          <tr className="border-b bg-primary/5">
            {allPeriodsData.map((snap) =>
              companies.map((c) => (
                <th key={`${snap.group.key}-${c.name}`} className="text-center px-3 py-2 text-xs font-medium whitespace-nowrap border-l">
                  <span className="flex items-center gap-1 justify-center">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span style={{ color: c.color }}>{c.name}</span>
                  </span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {roots.map((root) => renderNode(root))}
        </tbody>
      </table>
    </div>
  );
}

// ─── مساعد عمود نسبة التغيير ─────────────────────────────────────────────────

function PctTd({ curr, prev }: { curr: number; prev: number }) {
  if (prev === 0) {
    return (
      <td className="px-2 py-2.5 text-center text-muted-foreground text-xs bg-muted/20 whitespace-nowrap">—</td>
    );
  }
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const up  = pct >= 0;
  return (
    <td className={cn("px-2 py-2.5 text-center text-xs font-semibold bg-muted/20 whitespace-nowrap", up ? "text-emerald-600" : "text-red-500")}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </td>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border p-12 text-center text-muted-foreground shadow-sm">
      لا توجد بيانات للعرض
    </div>
  );
}

// ─── نافذة القيود متعددة الشركات ─────────────────────────────────────────────

function MultiCompanyJournalModal({
  accountKey,
  accountNameAr,
  periods,
  companies,
  onClose,
}: {
  accountKey: string;
  accountNameAr: string;
  periods: string[];
  companies: { name: string; color: string }[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState(companies[0]?.name ?? "");
  const activeColor = companies.find((c) => c.name === activeTab)?.color;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <span className="font-semibold text-foreground">{accountNameAr}</span>
            <span className="text-muted-foreground text-sm">· {periods.join("، ")}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Company tabs */}
        <div className="flex border-b shrink-0 overflow-x-auto">
          {companies.map((c) => {
            const isActive = activeTab === c.name;
            return (
              <button
                key={c.name}
                onClick={() => setActiveTab(c.name)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-all flex items-center gap-1.5",
                  isActive ? "bg-opacity-5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
                style={isActive ? { borderBottomColor: c.color, color: c.color } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                {c.name}
              </button>
            );
          })}
        </div>

        {/* Journal entries content */}
        <div className="overflow-auto flex-1">
          <JournalEntriesContent
            key={activeTab}
            companyName={activeTab}
            companyColor={activeColor}
            accountKey={accountKey}
            periods={periods}
          />
        </div>
      </div>
    </div>
  );
}

function JournalEntriesContent({
  companyName,
  companyColor,
  accountKey,
  periods,
}: {
  companyName: string;
  companyColor?: string;
  accountKey: string;
  periods: string[];
}) {
  const [entries, setEntries] = useState<{
    id: string; date: string; entryNumber: string;
    description?: string; debit: number; credit: number;
    reference?: string; currency: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ companyName, accountKey });
    periods.forEach((p) => params.append("periods[]", p));
    fetch(`/api/journal-entries?${params}`)
      .then((r) => r.json())
      .then(({ entries: e }) => {
        setEntries(e ?? []);
        setLoading(false);
      });
  }, [companyName, accountKey]);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        لا توجد قيود محاسبية لهذا البند
      </div>
    );
  }

  const totalDebit  = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <table className="w-full text-sm">
      <thead className="border-b sticky top-0" style={companyColor ? { backgroundColor: companyColor + "18" } : undefined}>
        <tr>
          <th className="text-right px-4 py-3 font-semibold">التاريخ</th>
          <th className="text-right px-4 py-3 font-semibold">رقم القيد</th>
          <th className="text-right px-4 py-3 font-semibold">الوصف</th>
          <th className="text-left px-4 py-3 font-semibold">مدين</th>
          <th className="text-left px-4 py-3 font-semibold">دائن</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={e.id} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
            <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
              {new Date(e.date).toLocaleDateString("ar-SA")}
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-xs">{e.entryNumber}</td>
            <td className="px-4 py-2.5 text-right text-muted-foreground max-w-[240px] truncate">
              {e.description ?? e.reference ?? "—"}
            </td>
            <td className="px-4 py-2.5 text-left font-mono text-blue-600">
              {e.debit > 0 ? e.debit.toLocaleString("ar-SA") : "—"}
            </td>
            <td className="px-4 py-2.5 text-left font-mono text-red-500">
              {e.credit > 0 ? e.credit.toLocaleString("ar-SA") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-muted/50 border-t font-semibold">
        <tr>
          <td colSpan={3} className="px-4 py-2.5 text-right text-xs">الإجمالي</td>
          <td className="px-4 py-2.5 text-left font-mono text-blue-600 text-xs">
            {totalDebit.toLocaleString("ar-SA")}
          </td>
          <td className="px-4 py-2.5 text-left font-mono text-red-500 text-xs">
            {totalCredit.toLocaleString("ar-SA")}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

// ─── مكونات التقارير ──────────────────────────────────────────────────────────

function CompanyComparisonReport({ allPeriodsData }: { allPeriodsData: PeriodSnapshot[] }) {
  if (allPeriodsData.length === 0) return <EmptyState />;

  const metrics: { kpiKey: keyof PnLKPIs; label: string }[] = [
    { kpiKey: "revenue",         label: "الإيرادات"      },
    { kpiKey: "grossProfit",     label: "إجمالي الربح"   },
    { kpiKey: "operatingIncome", label: "الدخل التشغيلي" },
    { kpiKey: "netIncome",       label: "صافي الدخل"     },
  ];
  const companies = allPeriodsData[0].byCompany;

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold" rowSpan={2}>البند</th>
            {allPeriodsData.map((snap, i) => [
              <th key={snap.group.key} className="text-center px-3 py-3 font-semibold whitespace-nowrap border-l" colSpan={companies.length}>
                {snap.group.labelAr}
              </th>,
              i < allPeriodsData.length - 1 && (
                <th key={`pct-h-${i}`} className="text-center px-2 py-3 text-xs text-muted-foreground bg-muted/20 border-l" rowSpan={2}>%</th>
              ),
            ])}
          </tr>
          <tr className="border-b bg-primary/5">
            {allPeriodsData.map((snap) =>
              companies.map((c) => (
                <th key={`${snap.group.key}-${c.name}`} className="text-center px-3 py-2 text-xs font-medium whitespace-nowrap border-l">
                  <span className="flex items-center gap-1 justify-center">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span style={{ color: c.color }}>{c.name}</span>
                  </span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, mi) => (
            <tr key={m.kpiKey} className={cn("border-b last:border-0", mi % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5 font-medium">{m.label}</td>
              {allPeriodsData.map((snap, pi) => {
                const consVal     = snap.consolidatedKpis[m.kpiKey];
                const nextConsVal = allPeriodsData[pi + 1]?.consolidatedKpis[m.kpiKey] ?? null;
                return [
                  ...companies.map((c) => {
                    const val = snap.byCompany.find((b) => b.name === c.name)?.kpis[m.kpiKey] ?? 0;
                    return (
                      <td key={`${snap.group.key}-${c.name}`} className={cn("px-3 py-2.5 text-left font-mono border-l", val >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {formatCurrency(val, "SAR", true)}
                      </td>
                    );
                  }),
                  nextConsVal !== null && <PctTd key={`pct-${pi}`} curr={nextConsVal} prev={consVal} />,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfitabilityReport({ allPeriodsData }: { allPeriodsData: PeriodSnapshot[] }) {
  if (allPeriodsData.length === 0) return <EmptyState />;

  const companies = allPeriodsData[0].byCompany;
  const profMetrics: { kpiKey: keyof PnLKPIs; label: string; fmt: (v: number) => string }[] = [
    { kpiKey: "netIncome",    label: "صافي الدخل",          fmt: (v) => formatCurrency(v, "SAR", true) },
    { kpiKey: "netMargin",    label: "هامش صافي %",          fmt: (v) => formatPercent(v) },
    { kpiKey: "grossMargin",  label: "هامش إجمالي الربح %",  fmt: (v) => formatPercent(v) },
  ];

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold" rowSpan={2}>البند</th>
            {allPeriodsData.map((snap, i) => [
              <th key={snap.group.key} className="text-center px-3 py-3 font-semibold whitespace-nowrap border-l" colSpan={companies.length}>
                {snap.group.labelAr}
              </th>,
              i < allPeriodsData.length - 1 && (
                <th key={`pct-h-${i}`} className="text-center px-2 py-3 text-xs text-muted-foreground bg-muted/20 border-l" rowSpan={2}>%</th>
              ),
            ])}
          </tr>
          <tr className="border-b bg-primary/5">
            {allPeriodsData.map((snap) =>
              companies.map((c) => (
                <th key={`${snap.group.key}-${c.name}`} className="text-center px-3 py-2 text-xs font-medium whitespace-nowrap border-l">
                  <span className="flex items-center gap-1 justify-center">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span style={{ color: c.color }}>{c.name}</span>
                  </span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {profMetrics.map((m, mi) => (
            <tr key={m.kpiKey} className={cn("border-b last:border-0", mi % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5 font-medium">{m.label}</td>
              {allPeriodsData.map((snap, pi) => {
                const consVal     = snap.consolidatedKpis[m.kpiKey];
                const nextConsVal = allPeriodsData[pi + 1]?.consolidatedKpis[m.kpiKey] ?? null;
                return [
                  ...companies.map((c) => {
                    const val = snap.byCompany.find((b) => b.name === c.name)?.kpis[m.kpiKey] ?? 0;
                    return (
                      <td key={`${snap.group.key}-${c.name}`} className={cn("px-3 py-2.5 text-left border-l", val >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {m.fmt(val)}
                      </td>
                    );
                  }),
                  nextConsVal !== null && <PctTd key={`pct-${pi}`} curr={nextConsVal} prev={consVal} />,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankingReport({ periodDataByCompany }: { periodDataByCompany: CompanyPeriodData[] }) {
  const sorted = [...periodDataByCompany].sort((a, b) => b.kpis.netIncome - a.kpis.netIncome);
  const max    = Math.max(...sorted.map((c) => Math.abs(c.kpis.netIncome)), 1);
  return (
    <div className="space-y-3">
      {sorted.map((c, i) => (
        <div key={c.name} className="flex items-center gap-3 p-3 bg-card rounded-xl border">
          <span className="text-2xl font-bold text-muted-foreground w-8">{i + 1}</span>
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
          <span className="w-32 font-medium truncate" style={{ color: c.color }}>{c.name}</span>
          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(Math.abs(c.kpis.netIncome) / max) * 100}%`, backgroundColor: c.color }}
            />
          </div>
          <span className={cn("font-mono text-sm w-28 text-left", c.kpis.netIncome >= 0 ? "text-positive" : "text-negative")}>
            {formatCurrency(c.kpis.netIncome, "SAR", true)}
          </span>
          <span className="text-sm text-muted-foreground w-16 text-left">
            {formatPercent(c.kpis.netMargin)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ContributionReport({ periodDataByCompany }: { periodDataByCompany: CompanyPeriodData[] }) {
  const totalRevenue = periodDataByCompany.reduce((s, c) => s + c.kpis.revenue, 0);
  const totalNet     = periodDataByCompany.reduce((s, c) => s + Math.max(c.kpis.netIncome, 0), 0);
  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold">الشركة</th>
            <th className="text-left px-4 py-3 font-semibold">الإيرادات</th>
            <th className="text-left px-4 py-3 font-semibold">نسبة الإيرادات %</th>
            <th className="text-left px-4 py-3 font-semibold">صافي الدخل</th>
            <th className="text-left px-4 py-3 font-semibold">نسبة المساهمة %</th>
          </tr>
        </thead>
        <tbody>
          {periodDataByCompany.map((c, i) => {
            const revPct = totalRevenue > 0 ? (c.kpis.revenue / totalRevenue) * 100 : 0;
            const netPct = totalNet > 0 ? (Math.max(c.kpis.netIncome, 0) / totalNet) * 100 : 0;
            return (
              <tr key={c.name} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span style={{ color: c.color }}>{c.name}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-left font-mono">{formatCurrency(c.kpis.revenue, "SAR", true)}</td>
                <td className="px-4 py-2.5 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div className="h-full rounded-full" style={{ width: `${revPct}%`, backgroundColor: c.color }} />
                    </div>
                    <span className="text-xs">{revPct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className={cn("px-4 py-2.5 text-left font-mono", c.kpis.netIncome >= 0 ? "text-positive" : "text-negative")}>
                  {formatCurrency(c.kpis.netIncome, "SAR", true)}
                </td>
                <td className="px-4 py-2.5 text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div className="h-full rounded-full" style={{ width: `${netPct}%`, backgroundColor: c.color }} />
                    </div>
                    <span className="text-xs">{netPct.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RevenueComparisonReport({ allPeriodsData }: { allPeriodsData: PeriodSnapshot[] }) {
  if (allPeriodsData.length === 0) return <EmptyState />;

  const companies = allPeriodsData[0].byCompany;
  const revMetrics: { kpiKey: keyof PnLKPIs; label: string }[] = [
    { kpiKey: "revenue",     label: "الإيرادات"    },
    { kpiKey: "grossProfit", label: "إجمالي الربح" },
  ];

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold" rowSpan={2}>البند</th>
            {allPeriodsData.map((snap, i) => [
              <th key={snap.group.key} className="text-center px-3 py-3 font-semibold whitespace-nowrap border-l" colSpan={companies.length}>
                {snap.group.labelAr}
              </th>,
              i < allPeriodsData.length - 1 && (
                <th key={`pct-h-${i}`} className="text-center px-2 py-3 text-xs text-muted-foreground bg-muted/20 border-l" rowSpan={2}>%</th>
              ),
            ])}
          </tr>
          <tr className="border-b bg-primary/5">
            {allPeriodsData.map((snap) =>
              companies.map((c) => (
                <th key={`${snap.group.key}-${c.name}`} className="text-center px-3 py-2 text-xs font-medium whitespace-nowrap border-l">
                  <span className="flex items-center gap-1 justify-center">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span style={{ color: c.color }}>{c.name}</span>
                  </span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {revMetrics.map((m, mi) => (
            <tr key={m.kpiKey} className={cn("border-b last:border-0", mi % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5 font-medium">{m.label}</td>
              {allPeriodsData.map((snap, pi) => {
                const consVal     = snap.consolidatedKpis[m.kpiKey];
                const nextConsVal = allPeriodsData[pi + 1]?.consolidatedKpis[m.kpiKey] ?? null;
                return [
                  ...companies.map((c) => {
                    const val = snap.byCompany.find((b) => b.name === c.name)?.kpis[m.kpiKey] ?? 0;
                    return (
                      <td key={`${snap.group.key}-${c.name}`} className="px-3 py-2.5 text-left font-mono text-emerald-600 border-l">
                        {formatCurrency(val, "SAR", true)}
                      </td>
                    );
                  }),
                  nextConsVal !== null && <PctTd key={`pct-${pi}`} curr={nextConsVal} prev={consVal} />,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseComparisonReport({ allPeriodsData }: { allPeriodsData: PeriodSnapshot[] }) {
  if (allPeriodsData.length === 0) return <EmptyState />;

  const expenseRows = [
    { key: "cost_of_goods_sold",       label: "تكلفة البضاعة المباعة"     },
    { key: "selling_expenses",          label: "مصروفات البيع"              },
    { key: "general_admin_expenses",    label: "مصروفات الإدارة والعمومية"  },
    { key: "depreciation_amortization", label: "الاستهلاك والإطفاء"         },
    { key: "other_expenses",            label: "مصروفات أخرى"               },
    { key: "zakat_expense",             label: "الزكاة"                      },
  ];

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold">بند المصروف</th>
            {allPeriodsData.map((snap, i) => [
              <th key={snap.group.key} className="text-left px-3 py-3 font-semibold whitespace-nowrap min-w-[120px]">
                {snap.group.labelAr}
              </th>,
              i < allPeriodsData.length - 1 && (
                <th key={`pct-h-${i}`} className="text-center px-2 py-3 text-xs text-muted-foreground bg-muted/20">%</th>
              ),
            ])}
          </tr>
        </thead>
        <tbody>
          {expenseRows.map((row, i) => (
            <tr key={row.key} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5 font-medium">{row.label}</td>
              {allPeriodsData.map((snap, pi) => {
                const val     = snap.consolidatedData[row.key] ?? 0;
                const nextVal = pi < allPeriodsData.length - 1
                  ? (allPeriodsData[pi + 1].consolidatedData[row.key] ?? 0)
                  : null;
                return [
                  <td key={`val-${pi}`} className="px-3 py-2.5 text-left font-mono text-red-500">
                    {val !== 0 ? formatCurrency(val, "SAR", true) : "—"}
                  </td>,
                  nextVal !== null && <PctTd key={`pct-${pi}`} curr={nextVal} prev={val} />,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginComparisonReport({ allPeriodsData }: { allPeriodsData: PeriodSnapshot[] }) {
  if (allPeriodsData.length === 0) return <EmptyState />;

  const companies = allPeriodsData[0].byCompany;
  const marginMetrics: { kpiKey: keyof PnLKPIs; label: string }[] = [
    { kpiKey: "grossMargin",    label: "هامش إجمالي الربح %"    },
    { kpiKey: "operatingMargin", label: "هامش الربح التشغيلي %" },
    { kpiKey: "ebitdaMargin",   label: "هامش EBITDA %"          },
    { kpiKey: "netMargin",      label: "هامش صافي الربح %"       },
  ];

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold" rowSpan={2}>المقياس</th>
            {allPeriodsData.map((snap, i) => [
              <th key={snap.group.key} className="text-center px-3 py-3 font-semibold whitespace-nowrap border-l" colSpan={companies.length}>
                {snap.group.labelAr}
              </th>,
              i < allPeriodsData.length - 1 && (
                <th key={`pct-h-${i}`} className="text-center px-2 py-3 text-xs text-muted-foreground bg-muted/20 border-l" rowSpan={2}>%</th>
              ),
            ])}
          </tr>
          <tr className="border-b bg-primary/5">
            {allPeriodsData.map((snap) =>
              companies.map((c) => (
                <th key={`${snap.group.key}-${c.name}`} className="text-center px-3 py-2 text-xs font-medium whitespace-nowrap border-l">
                  <span className="flex items-center gap-1 justify-center">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span style={{ color: c.color }}>{c.name}</span>
                  </span>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {marginMetrics.map((m, mi) => (
            <tr key={m.kpiKey} className={cn("border-b last:border-0", mi % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5 font-medium">{m.label}</td>
              {allPeriodsData.map((snap, pi) => {
                const consVal     = snap.consolidatedKpis[m.kpiKey];
                const nextConsVal = allPeriodsData[pi + 1]?.consolidatedKpis[m.kpiKey] ?? null;
                return [
                  ...companies.map((c) => {
                    const val = snap.byCompany.find((b) => b.name === c.name)?.kpis[m.kpiKey] ?? 0;
                    return (
                      <td key={`${snap.group.key}-${c.name}`} className={cn("px-3 py-2.5 text-left border-l", val >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {formatPercent(val)}
                      </td>
                    );
                  }),
                  nextConsVal !== null && <PctTd key={`pct-${pi}`} curr={nextConsVal} prev={consVal} />,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VarianceReport({ allPeriodsData }: { allPeriodsData: PeriodSnapshot[] }) {
  if (allPeriodsData.length === 0) return <EmptyState />;

  const companyNames = allPeriodsData[0].byCompany.map((c) => c.name);
  const metrics: { kpiKey: keyof PnLKPIs; label: string }[] = [
    { kpiKey: "revenue",         label: "الإيرادات"      },
    { kpiKey: "grossProfit",     label: "إجمالي الربح"   },
    { kpiKey: "operatingIncome", label: "الدخل التشغيلي" },
    { kpiKey: "netIncome",       label: "صافي الدخل"     },
  ];

  return (
    <div className="space-y-4">
      {companyNames.map((name) => {
        const color = allPeriodsData[0].byCompany.find((c) => c.name === name)?.color;
        return (
          <div key={name} className="rounded-xl border overflow-auto shadow-sm">
            <div className="px-4 py-3 bg-primary/10 border-b flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-semibold" style={{ color }}>{name}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold">البند</th>
                  {allPeriodsData.map((snap, i) => [
                    <th key={snap.group.key} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap min-w-[120px]">
                      {snap.group.labelAr}
                    </th>,
                    i < allPeriodsData.length - 1 && (
                      <th key={`pct-h-${i}`} className="text-center px-2 py-2.5 text-xs text-muted-foreground bg-muted/20">%</th>
                    ),
                  ])}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, mi) => (
                  <tr key={m.kpiKey} className={cn("border-b last:border-0", mi % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                    <td className="px-4 py-2.5 font-medium">{m.label}</td>
                    {allPeriodsData.map((snap, pi) => {
                      const pd      = snap.byCompany.find((c) => c.name === name);
                      const val     = pd?.kpis[m.kpiKey] ?? 0;
                      const nextPd  = allPeriodsData[pi + 1]?.byCompany.find((c) => c.name === name);
                      const nextVal = nextPd !== undefined ? (nextPd.kpis[m.kpiKey] ?? 0) : null;
                      return [
                        <td key={`val-${pi}`} className={cn("px-3 py-2.5 text-left font-mono", val >= 0 ? "text-emerald-600" : "text-red-500")}>
                          {formatCurrency(val, "SAR", true)}
                        </td>,
                        nextVal !== null && <PctTd key={`pct-${pi}`} curr={nextVal} prev={val} />,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function GroupTrendReport({ allPeriodsData }: { allPeriodsData: PeriodSnapshot[] }) {
  if (allPeriodsData.length === 0) return <EmptyState />;

  const metrics: { kpiKey: keyof PnLKPIs; label: string }[] = [
    { kpiKey: "revenue",         label: "الإيرادات"      },
    { kpiKey: "grossProfit",     label: "إجمالي الربح"   },
    { kpiKey: "operatingIncome", label: "الدخل التشغيلي" },
    { kpiKey: "netIncome",       label: "صافي الدخل"     },
  ];

  return (
    <div className="rounded-xl border overflow-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 border-b">
          <tr>
            <th className="text-right px-4 py-3 font-semibold">المقياس</th>
            {allPeriodsData.map((snap, i) => [
              <th key={snap.group.key} className="text-left px-3 py-3 font-semibold whitespace-nowrap min-w-[120px]">
                {snap.group.labelAr}
              </th>,
              i < allPeriodsData.length - 1 && (
                <th key={`pct-h-${i}`} className="text-center px-2 py-3 text-xs text-muted-foreground bg-muted/20">%</th>
              ),
            ])}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr key={m.kpiKey} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
              <td className="px-4 py-2.5 font-semibold">{m.label}</td>
              {allPeriodsData.map((snap, pi) => {
                const val     = snap.consolidatedKpis[m.kpiKey];
                const nextVal = pi < allPeriodsData.length - 1 ? allPeriodsData[pi + 1].consolidatedKpis[m.kpiKey] : null;
                return [
                  <td key={`val-${pi}`} className={cn("px-3 py-2.5 text-left font-mono", val >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {formatCurrency(val, "SAR", true)}
                  </td>,
                  nextVal !== null && <PctTd key={`pct-${pi}`} curr={nextVal} prev={val} />,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
