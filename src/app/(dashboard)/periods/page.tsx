"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CalendarDays, Trash2, Building2, Search,
  ChevronRight, BookOpen, FileText, AlertTriangle,
} from "lucide-react";
import { formatPeriodAr } from "@/lib/pnl-calculations";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { JournalEntry } from "@/lib/pnl-types";

// ─── types ────────────────────────────────────────────────────────────────────

interface LineItem { key: string; amount: number }

interface Dataset {
  id: string;
  companyName: string;
  period: string;
  currency: string;
  createdAt: string;
  parsed: { lineItems: LineItem[] } | null;
}

interface SectionDisplay {
  key: string;
  nameAr: string;
  allKeys: string[];   // all keys to remove on delete
  items: { key: string; nameAr: string; amount: number }[];
}

// ─── static maps ─────────────────────────────────────────────────────────────

// Keys computed automatically — never shown individually
const CALCULATED_KEYS = new Set([
  "gross_profit", "operating_income", "income_before_zakat",
  "net_income", "operating_expenses",
]);

// Parent section definitions (key → nameAr + leaf children)
const PARENT_SECTIONS = [
  { key: "revenue",                nameAr: "الإيرادات",                     leafKeys: ["sales_revenue", "service_revenue", "other_revenue"] },
  { key: "cost_of_goods_sold",     nameAr: "تكلفة البضاعة المباعة",          leafKeys: ["raw_materials", "direct_labor", "manufacturing_overhead", "purchases"] },
  { key: "selling_expenses",       nameAr: "مصروفات البيع والتسويق",          leafKeys: ["sales_commissions", "advertising_promotion", "marketing_expenses", "delivery_shipping", "customer_service"] },
  { key: "general_admin_expenses", nameAr: "المصروفات الإدارية والعمومية",    leafKeys: ["salaries_wages", "employee_benefits", "gosi_subscriptions", "rent", "utilities", "communications", "stationery", "professional_fees", "travel_hospitality", "insurance", "maintenance", "licenses", "subscriptions_software", "bad_debts", "miscellaneous_expenses"] },
  { key: "depreciation_amortization", nameAr: "الإهلاك والاستنفاد",          leafKeys: ["building_depreciation", "equipment_depreciation", "vehicle_depreciation", "intangible_amortization"] },
  { key: "other_items",            nameAr: "بنود أخرى",                     leafKeys: ["investment_income", "islamic_finance_cost", "other_income", "other_expenses", "zakat_expense"] },
];

const KEY_NAME_AR: Record<string, string> = {
  revenue: "الإيرادات", sales_revenue: "إيرادات المبيعات", service_revenue: "إيرادات الخدمات", other_revenue: "إيرادات أخرى",
  cost_of_goods_sold: "تكلفة البضاعة المباعة", raw_materials: "المواد الخام", direct_labor: "العمالة المباشرة",
  manufacturing_overhead: "مصروفات التصنيع غير المباشرة", purchases: "المشتريات",
  gross_profit: "إجمالي الربح", operating_expenses: "المصروفات التشغيلية",
  selling_expenses: "مصروفات البيع والتسويق", sales_commissions: "عمولات المبيعات",
  advertising_promotion: "الإعلان والترويج", marketing_expenses: "مصروفات التسويق",
  delivery_shipping: "التوصيل والشحن", customer_service: "خدمة العملاء",
  general_admin_expenses: "المصروفات الإدارية والعمومية", salaries_wages: "الرواتب والأجور",
  employee_benefits: "بدلات ومزايا الموظفين", gosi_subscriptions: "اشتراكات GOSI",
  rent: "الإيجارات", utilities: "المرافق", communications: "الاتصالات", stationery: "القرطاسية",
  professional_fees: "الأتعاب المهنية", travel_hospitality: "السفر والضيافة",
  insurance: "التأمين", maintenance: "الصيانة", licenses: "التراخيص",
  subscriptions_software: "الاشتراكات والبرمجيات", bad_debts: "الديون المعدومة",
  miscellaneous_expenses: "مصروفات متنوعة", depreciation_amortization: "الإهلاك والاستنفاد",
  building_depreciation: "إهلاك المباني", equipment_depreciation: "إهلاك المعدات",
  vehicle_depreciation: "إهلاك السيارات", intangible_amortization: "استنفاد الأصول غير الملموسة",
  operating_income: "الدخل التشغيلي", income_before_zakat: "الدخل قبل الزكاة",
  investment_income: "إيرادات الاستثمارات", islamic_finance_cost: "تكلفة التمويل الإسلامي",
  other_income: "إيرادات أخرى", other_expenses: "مصروفات أخرى", zakat_expense: "مصروف الزكاة",
  net_income: "صافي الدخل",
};

// Build a flat map: any key → which parent section it belongs to
const KEY_TO_SECTION = new Map<string, typeof PARENT_SECTIONS[number]>();
for (const sec of PARENT_SECTIONS) {
  KEY_TO_SECTION.set(sec.key, sec);
  for (const k of sec.leafKeys) KEY_TO_SECTION.set(k, sec);
}

// Build sections from actual dataset lineItems
function buildSections(lineItems: LineItem[]): SectionDisplay[] {
  const sectionMap = new Map<string, SectionDisplay>();

  for (const { key, amount } of lineItems) {
    if (amount === 0 || CALCULATED_KEYS.has(key)) continue;

    const parent = KEY_TO_SECTION.get(key);

    if (parent) {
      if (!sectionMap.has(parent.key)) {
        sectionMap.set(parent.key, {
          key: parent.key,
          nameAr: parent.nameAr,
          allKeys: [parent.key, ...parent.leafKeys],
          items: [],
        });
      }
      // Don't duplicate: if this is the parent aggregate key AND we already have its children, skip
      // Otherwise add it
      const sec = sectionMap.get(parent.key)!;
      // Only add if this key isn't already the parent key shown via children
      const alreadyHasChildren = sec.items.some((i) => parent.leafKeys.includes(i.key));
      if (key === parent.key && alreadyHasChildren) continue;
      if (!sec.items.find((i) => i.key === key)) {
        sec.items.push({ key, nameAr: KEY_NAME_AR[key] ?? key, amount });
      }
    } else {
      // Unknown key — show under its own section
      const nameAr = KEY_NAME_AR[key] ?? key;
      sectionMap.set(key, {
        key,
        nameAr,
        allKeys: [key],
        items: [{ key, nameAr, amount }],
      });
    }
  }

  // Keep ordering from PARENT_SECTIONS, then any extras
  const ordered: SectionDisplay[] = [];
  for (const ps of PARENT_SECTIONS) {
    if (sectionMap.has(ps.key)) ordered.push(sectionMap.get(ps.key)!);
  }
  for (const [k, sec] of sectionMap) {
    if (!PARENT_SECTIONS.find((ps) => ps.key === k)) ordered.push(sec);
  }

  return ordered;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function PeriodsPage() {
  const [datasets, setDatasets]           = useState<Dataset[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [confirm, setConfirm]             = useState<Dataset | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // detail state
  const [selected, setSelected]           = useState<Dataset | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loadingJE, setLoadingJE]         = useState(false);
  const [confirmCat, setConfirmCat]       = useState<SectionDisplay | null>(null);
  const [deletingCat, setDeletingCat]     = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/pnl/save-batch");
    const { datasets: raw } = await res.json();
    setDatasets(
      (raw as Dataset[]).sort((a, b) =>
        a.companyName.localeCompare(b.companyName, "ar") || b.period.localeCompare(a.period)
      )
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openDetail(d: Dataset) {
    setSelected(d);
    setJournalEntries([]);
    setLoadingJE(true);
    try {
      const res = await fetch(
        `/api/journal-entries?companyName=${encodeURIComponent(d.companyName)}&period=${d.period}`
      );
      const { entries } = await res.json();
      setJournalEntries(entries ?? []);
    } catch {
      setJournalEntries([]);
    }
    setLoadingJE(false);
  }

  async function handleDeletePeriod() {
    if (!confirm) return;
    setDeleting(true);
    await fetch(`/api/pnl/${confirm.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirm(null);
    if (selected?.id === confirm.id) setSelected(null);
    load();
  }

  async function handleDeleteCategory() {
    if (!confirmCat || !selected) return;
    setDeletingCat(true);
    await fetch(`/api/pnl/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keysToRemove: confirmCat.allKeys }),
    });
    setDeletingCat(false);
    setConfirmCat(null);
    // Refresh dataset
    const res = await fetch(`/api/pnl/${selected.id}`);
    const { dataset } = await res.json();
    setSelected(dataset as Dataset);
    load();
  }

  const companies = useMemo(
    () => ["all", ...Array.from(new Set(datasets.map((d) => d.companyName)))],
    [datasets]
  );

  const filtered = useMemo(() => {
    return datasets.filter((d) => {
      const matchCompany = filterCompany === "all" || d.companyName === filterCompany;
      const matchSearch  = search === "" ||
        d.companyName.includes(search) ||
        d.period.includes(search) ||
        formatPeriodAr(d.period, "monthly").includes(search);
      return matchCompany && matchSearch;
    });
  }, [datasets, filterCompany, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Dataset[]>();
    filtered.forEach((d) => {
      if (!map.has(d.companyName)) map.set(d.companyName, []);
      map.get(d.companyName)!.push(d);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────
  if (selected) {
    const lineItems: LineItem[] = selected.parsed?.lineItems ?? [];
    const sections = buildSections(lineItems);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-1 border-b-2 border-primary/30">
          <button
            onClick={() => setSelected(null)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={18} />
          </button>
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {formatPeriodAr(selected.period, "monthly")}
            </h1>
            <p className="text-xs text-muted-foreground">{selected.companyName} · {selected.currency}</p>
          </div>
          <button
            onClick={() => setConfirm(selected)}
            className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-500 border border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 size={14} />
            حذف الفترة كاملاً
          </button>
        </div>

        {/* Categories section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BookOpen size={15} className="text-primary" />
            التصنيفات والبنود
            <span className="text-xs font-normal text-muted-foreground">({sections.length} تصنيف)</span>
          </div>

          {sections.length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground text-sm">
              لا توجد بنود مسجلة في هذه الفترة
            </div>
          ) : (
            <div className="grid gap-2">
              {sections.map((sec) => {
                const total = sec.items.reduce((s, i) => s + i.amount, 0);
                return (
                  <div key={sec.key} className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border-b">
                      <span className="font-semibold text-sm text-primary flex-1">{sec.nameAr}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatNumber(total)} {selected.currency}
                      </span>
                      <button
                        onClick={() => setConfirmCat(sec)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="حذف هذا التصنيف"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {sec.items.length > 1 && (
                      <table className="w-full text-sm">
                        <tbody>
                          {sec.items.map((item, i) => (
                            <tr
                              key={item.key}
                              className={cn("border-b last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}
                            >
                              <td className="px-4 py-2 text-foreground">{item.nameAr}</td>
                              <td className="px-4 py-2 text-left font-mono text-xs text-muted-foreground">
                                {formatNumber(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Journal entries section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText size={15} className="text-primary" />
            القيود المحاسبية
            {!loadingJE && (
              <span className="text-xs font-normal text-muted-foreground">({journalEntries.length} قيد)</span>
            )}
          </div>

          {loadingJE ? (
            <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : journalEntries.length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center text-muted-foreground text-sm">
              لا توجد قيود محاسبية لهذه الفترة
            </div>
          ) : (
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-right px-3 py-2 font-medium">التاريخ</th>
                      <th className="text-right px-3 py-2 font-medium">رقم القيد</th>
                      <th className="text-right px-3 py-2 font-medium">الحساب</th>
                      <th className="text-right px-3 py-2 font-medium">البيان</th>
                      <th className="text-left px-3 py-2 font-medium">مدين</th>
                      <th className="text-left px-3 py-2 font-medium">دائن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.map((je, i) => (
                      <tr
                        key={je.id}
                        className={cn("border-b last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}
                      >
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(je.date).toLocaleDateString("ar-SA")}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{je.entryNumber}</td>
                        <td className="px-3 py-2 font-medium">{je.accountNameAr}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{je.description ?? "—"}</td>
                        <td className="px-3 py-2 text-left font-mono text-xs text-green-600 dark:text-green-400">
                          {je.debit > 0 ? formatNumber(je.debit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-left font-mono text-xs text-blue-600 dark:text-blue-400">
                          {je.credit > 0 ? formatNumber(je.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Delete category dialog */}
        {confirmCat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-card rounded-2xl border shadow-lg w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-950/40">
                  <AlertTriangle size={18} className="text-orange-500" />
                </div>
                <h2 className="font-bold">حذف التصنيف</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                هل تريد حذف بيانات تصنيف{" "}
                <span className="font-semibold text-foreground">{confirmCat.nameAr}</span>{" "}
                من فترة{" "}
                <span className="font-semibold text-foreground">{formatPeriodAr(selected.period, "monthly")}</span>؟
                <span className="text-orange-500 text-xs mt-1 block">
                  سيتم حذف جميع البنود ضمن هذا التصنيف فقط.
                </span>
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmCat(null)} disabled={deletingCat}
                  className="px-4 py-2 rounded-lg text-sm border hover:bg-muted transition-colors">
                  إلغاء
                </button>
                <button onClick={handleDeleteCategory} disabled={deletingCat}
                  className="px-4 py-2 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-60">
                  {deletingCat ? "جارٍ الحذف..." : "حذف التصنيف"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete period dialog */}
        {confirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-card rounded-2xl border shadow-lg w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-950/40">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <h2 className="font-bold">تأكيد الحذف</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                هل تريد حذف بيانات{" "}
                <span className="font-semibold text-foreground">{formatPeriodAr(confirm.period, "monthly")}</span>{" "}
                لشركة <span className="font-semibold text-foreground">{confirm.companyName}</span>؟
                <span className="text-red-500 text-xs mt-1 block">لا يمكن التراجع عن هذا الإجراء.</span>
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirm(null)} disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm border hover:bg-muted transition-colors">إلغاء</button>
                <button onClick={handleDeletePeriod} disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60">
                  {deleting ? "جارٍ الحذف..." : "حذف"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-1 border-b-2 border-primary/30">
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarDays size={20} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">إدارة الفترات</h1>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border p-4 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث..."
            className="w-full pr-8 pl-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-muted-foreground" />
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="text-sm border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">كل الشركات</option>
            {companies.filter((c) => c !== "all").map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted-foreground mr-auto">{filtered.length} فترة</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-card rounded-xl border p-12 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
      ) : grouped.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center text-muted-foreground text-sm">لا توجد فترات</div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([company, rows]) => (
            <div key={company} className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/5 border-b">
                <Building2 size={14} className="text-primary" />
                <span className="font-semibold text-sm text-primary">{company}</span>
                <span className="text-xs text-muted-foreground">({rows.length} فترة)</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="text-right px-4 py-2 font-medium">الفترة</th>
                    <th className="text-right px-4 py-2 font-medium">الشهر</th>
                    <th className="text-right px-4 py-2 font-medium">العملة</th>
                    <th className="text-right px-4 py-2 font-medium">تاريخ الإضافة</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d, i) => (
                    <tr
                      key={d.id}
                      onClick={() => openDetail(d)}
                      className={cn(
                        "border-b last:border-0 cursor-pointer transition-colors hover:bg-primary/5",
                        i % 2 === 0 ? "" : "bg-muted/20"
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.period}</td>
                      <td className="px-4 py-2.5 font-medium">{formatPeriodAr(d.period, "monthly")}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{d.currency}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {new Date(d.createdAt).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="px-4 py-2.5 text-left">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirm(d); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Delete period dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border shadow-lg w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-950/40">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h2 className="font-bold">تأكيد الحذف</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              هل تريد حذف بيانات{" "}
              <span className="font-semibold text-foreground">{formatPeriodAr(confirm.period, "monthly")}</span>{" "}
              لشركة <span className="font-semibold text-foreground">{confirm.companyName}</span>؟
              <span className="text-red-500 text-xs mt-1 block">لا يمكن التراجع عن هذا الإجراء.</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-muted transition-colors">إلغاء</button>
              <button onClick={handleDeletePeriod} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60">
                {deleting ? "جارٍ الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
