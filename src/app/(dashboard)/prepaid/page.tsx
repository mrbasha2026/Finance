"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Receipt, Search, ChevronDown, BarChart3,
  CreditCard, Calendar, TrendingDown, Clock, Eye, Pencil, X,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, addMonths, format,
  differenceInCalendarDays, getDaysInMonth,
  max as dateMax, min as dateMin, isSameMonth,
} from "date-fns";
import { ar } from "date-fns/locale";
import { formatCurrency } from "@/lib/format";
import { SkeletonTable } from "@/components/shared/SkeletonLoaders";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PrepaidItem {
  id: string;
  vendorName: string;
  nameAr?: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
  monthlyAmount: number; // base rate = amount / totalDayUnits
  description?: string;
  status: string;
  type: string;
  companyId: string;
  company?: { id: string; name: string; color: string };
}

interface Company { id: string; name: string; color: string; }

interface AmortMonth {
  month: Date;
  days: number;
  isPartial: boolean;
  unit: number;
  amount: number;
  cumulative: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const EXPENSE_TYPES = [
  "إيجار", "تأمين", "اشتراكات", "صيانة", "ترخيص", "دعاية",
  "برمجيات", "خدمات", "تدريب", "استشارات", "قانونية", "مرافق", "نقل وشحن", "ضمانات",
  "أخرى",
] as const;

const TYPE_COLORS: Record<string, string> = {
  "إيجار":     "#3b82f6",
  "تأمين":     "#10b981",
  "اشتراكات":  "#8b5cf6",
  "صيانة":     "#f59e0b",
  "ترخيص":     "#ec4899",
  "دعاية":     "#06b6d4",
  "برمجيات":   "#0ea5e9",
  "خدمات":     "#ef4444",
  "تدريب":     "#14b8a6",
  "استشارات":  "#f97316",
  "قانونية":   "#a855f7",
  "مرافق":     "#84cc16",
  "نقل وشحن": "#d97706",
  "ضمانات":    "#6366f1",
  "أخرى":      "#6b7280",
};

// ─── Amortization Helper ───────────────────────────────────────────────────────

function calcTotalUnits(start: Date, end: Date): number {
  let units = 0;
  let cur = startOfMonth(start);
  const last = startOfMonth(end);
  while (cur <= last) {
    const mStart = dateMax([start, startOfMonth(cur)]);
    const mEnd = dateMin([end, endOfMonth(cur)]);
    const dim = getDaysInMonth(cur);
    units += (differenceInCalendarDays(mEnd, mStart) + 1) / dim;
    cur = addMonths(cur, 1);
  }
  return Math.max(units, 1 / 31);
}

function buildSchedule(item: PrepaidItem): AmortMonth[] {
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  const baseRate = item.amount / calcTotalUnits(start, end);

  const rows: AmortMonth[] = [];
  let cur = startOfMonth(start);
  const last = startOfMonth(end);
  let cumulative = 0;

  while (cur <= last) {
    const mStart = dateMax([start, startOfMonth(cur)]);
    const mEnd = dateMin([end, endOfMonth(cur)]);
    const days = differenceInCalendarDays(mEnd, mStart) + 1;
    const daysInMonth = getDaysInMonth(cur);
    const isPartial = days < daysInMonth;
    const unit = days / daysInMonth;
    const amount = baseRate * unit;
    cumulative += amount;
    rows.push({ month: new Date(cur), days, isPartial, unit, amount, cumulative });
    cur = addMonths(cur, 1);
  }
  return rows;
}

function consumedUpToNow(item: PrepaidItem, now: Date): number {
  const schedule = buildSchedule(item);
  const curMonth = startOfMonth(now);
  return schedule
    .filter(r => r.month <= curMonth)
    .reduce((s, r) => s + r.amount, 0);
}

function thisMonthAmount(item: PrepaidItem, now: Date): number {
  const schedule = buildSchedule(item);
  const curMonth = startOfMonth(now);
  return schedule.find(r => isSameMonth(r.month, curMonth))?.amount ?? 0;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  vendorName: "", nameAr: "", companyId: "", type: "إيجار" as string,
  currency: "SAR", amount: "", startDate: "", endDate: "", description: "",
};

export default function PrepaidPage() {
  const [items, setItems] = useState<PrepaidItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // UI modals/tabs
  const [activeTab, setActiveTab] = useState<"expenses" | "monthly" | "analytics" | "forecasts">("expenses");
  const [selectedItem, setSelectedItem] = useState<PrepaidItem | null>(null);
  const [editingItem, setEditingItem] = useState<PrepaidItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(""); // "YYYY-MM"
  const [dateTo, setDateTo] = useState("");
  const [companyDropOpen, setCompanyDropOpen] = useState(false);

  // form (add + edit share state)
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const companyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (companyRef.current && !companyRef.current.contains(e.target as Node))
        setCompanyDropOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  async function load() {
    setLoading(true);
    const [pr, cr] = await Promise.all([fetch("/api/prepaid"), fetch("/api/companies")]);
    const { expenses } = await pr.json();
    const { companies: comps } = await cr.json();
    setItems(expenses ?? []);
    setCompanies(comps ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Filtered items ────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => items.filter(item => {
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
    if (selectedType !== "all" && item.type !== selectedType) return false;
    if (selectedCompanyIds.length > 0 && !selectedCompanyIds.includes(item.companyId)) return false;
    if (dateFrom) {
      const itemEnd = item.endDate.slice(0, 7);
      if (itemEnd < dateFrom) return false;
    }
    if (dateTo) {
      const itemStart = item.startDate.slice(0, 7);
      if (itemStart > dateTo) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.vendorName.toLowerCase().includes(q) && !(item.nameAr ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, selectedStatus, selectedType, selectedCompanyIds, dateFrom, dateTo, searchQuery]);

  const now = useMemo(() => new Date(), []);

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = filteredItems.reduce((s, i) => s + i.amount, 0);
    const consumed = filteredItems.reduce((s, i) => s + consumedUpToNow(i, now), 0);
    const remaining = total - consumed;
    const thisMonth = filteredItems.reduce((s, i) => s + thisMonthAmount(i, now), 0);
    return { total, consumed, remaining, thisMonth };
  }, [filteredItems, now]);

  // ── Form helpers ──────────────────────────────────────────────────────────────

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setAddOpen(true);
  }

  function openEdit(item: PrepaidItem) {
    setForm({
      vendorName: item.vendorName,
      nameAr: item.nameAr ?? "",
      companyId: item.companyId,
      type: item.type,
      currency: item.currency,
      amount: String(item.amount),
      startDate: item.startDate.slice(0, 10),
      endDate: item.endDate.slice(0, 10),
      description: item.description ?? "",
    });
    setEditingItem(item);
  }

  function closeDialog() {
    setAddOpen(false);
    setEditingItem(null);
  }

  // live preview units
  const previewUnits = useMemo(() => {
    if (!form.amount || !form.startDate || !form.endDate) return null;
    try {
      const s = new Date(form.startDate);
      const e = new Date(form.endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || s >= e) return null;

      const units = calcTotalUnits(s, e);

      const amt = parseFloat(form.amount);
      const months = Math.round(units);
      const baseRate = amt / units;
      return { units: units.toFixed(2), months, baseRate };
    } catch { return null; }
  }, [form.amount, form.startDate, form.endDate]);

  async function handleSave() {
    if (!form.companyId || !form.nameAr || !form.amount || !form.startDate || !form.endDate) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      vendorName: form.vendorName || form.nameAr,
      nameAr: form.nameAr,
    };

    const isEdit = !!editingItem;
    const url = isEdit ? `/api/prepaid/${editingItem!.id}` : "/api/prepaid";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(isEdit ? "تم التعديل بنجاح" : "تمت الإضافة بنجاح");
      closeDialog();
      load();
    } else {
      toast.error("حدث خطأ");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/prepaid/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("تم الحذف"); load(); }
    else toast.error("حدث خطأ");
    setDeleteId(null);
  }

  // company filter label
  const companyLabel = selectedCompanyIds.length === 0
    ? "جميع الشركات"
    : selectedCompanyIds.length === 1
      ? (companies.find(c => c.id === selectedCompanyIds[0])?.name ?? "1 شركة")
      : `${selectedCompanyIds.length} شركات`;

  const hasFilters = selectedStatus !== "all" || selectedType !== "all" || selectedCompanyIds.length > 0 || dateFrom || dateTo || searchQuery;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt size={22} className="text-primary" /> المصروفات المقدمة
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تتبع المصروفات المدفوعة مقدماً وجدول الإطفاء الشهري</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> إضافة مصروف
        </button>
      </div>

      {/* KPI Cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="إجمالي المصروفات المقدمة" value={formatCurrency(kpis.total, "SAR")}
            sub={`${filteredItems.length} مصروف مقدم`} icon={<CreditCard size={18} />}
            color="text-primary" bg="bg-primary/10" />
          <KpiCard label="المُطفأ حتى الآن" value={formatCurrency(kpis.consumed, "SAR")}
            sub="تراكمي حتى الشهر الحالي" icon={<TrendingDown size={18} />}
            color="text-violet-600" bg="bg-violet-100 dark:bg-violet-900/30" />
          <KpiCard label="المتبقي للإطفاء" value={formatCurrency(kpis.remaining, "SAR")}
            sub="لم يُطفأ بعد" icon={<Clock size={18} />}
            color="text-rose-500" bg="bg-rose-100 dark:bg-rose-900/30" />
          <KpiCard label="نصيب الشهر الحالي" value={formatCurrency(kpis.thisMonth, "SAR")}
            sub={format(now, "MMMM yyyy", { locale: ar })} icon={<BarChart3 size={18} />}
            color="text-amber-600" bg="bg-amber-100 dark:bg-amber-900/30" />
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-card border rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث..."
            className="h-9 pr-8 pl-3 w-36 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Company multi-select */}
        <div className="relative" ref={companyRef}>
          <button onClick={() => setCompanyDropOpen(v => !v)}
            className={cn(
              "flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm bg-background min-w-[130px] justify-between transition-colors",
              selectedCompanyIds.length > 0 && "border-primary text-primary"
            )}>
            <span className="truncate max-w-[110px]">{companyLabel}</span>
            <ChevronDown size={13} className={cn("shrink-0 transition-transform", companyDropOpen && "rotate-180")} />
          </button>
          {companyDropOpen && (
            <div className="absolute top-10 right-0 z-30 bg-card border rounded-xl shadow-xl p-1.5 min-w-[190px]">
              <label className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted cursor-pointer text-sm font-medium">
                <input type="checkbox" className="rounded" checked={selectedCompanyIds.length === 0}
                  onChange={() => setSelectedCompanyIds([])} />
                الجميع
              </label>
              <div className="h-px bg-border my-1" />
              {companies.map(c => (
                <label key={c.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted cursor-pointer text-sm">
                  <input type="checkbox" className="rounded" checked={selectedCompanyIds.includes(c.id)}
                    onChange={() => setSelectedCompanyIds(prev =>
                      prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                    )} />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="truncate" style={{ color: c.color }}>{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Type */}
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
          className="h-9 px-3 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
          <option value="all">جميع التصنيفات</option>
          {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Status */}
        <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
          <option value="all">جميع الحالات</option>
          <option value="active">نشط</option>
          <option value="completed">مكتمل</option>
        </select>

        <div className="w-px h-5 bg-border" />

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">من</span>
          <input type="month" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-2 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <span className="text-xs text-muted-foreground">إلى</span>
          <input type="month" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 px-2 rounded-lg border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>

        {hasFilters && (
          <button onClick={() => {
            setSearchQuery(""); setSelectedCompanyIds([]); setSelectedType("all");
            setSelectedStatus("all"); setDateFrom(""); setDateTo("");
          }} className="h-9 px-3 rounded-lg text-xs text-muted-foreground hover:bg-muted border border-dashed transition-colors">
            إعادة تعيين
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {([
          { id: "expenses", label: "المصروفات", icon: <CreditCard size={14} /> },
          { id: "monthly", label: "الجدول الشهري", icon: <Calendar size={14} /> },
          { id: "analytics", label: "التحليلات", icon: <BarChart3 size={14} /> },
          { id: "forecasts", label: "التوقعات", icon: <TrendingDown size={14} /> },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? <SkeletonTable rows={5} /> : (
        <>
          {activeTab === "expenses" && (
            <ExpensesTab items={filteredItems} now={now} companies={companies}
              onDetails={setSelectedItem} onEdit={openEdit} onDelete={setDeleteId} />
          )}
          {activeTab === "monthly" && <MonthlyTab items={filteredItems} now={now} />}
          {activeTab === "analytics" && <AnalyticsTab items={filteredItems} companies={companies} now={now} />}
          {activeTab === "forecasts" && <ForecastsTab items={filteredItems} now={now} />}
        </>
      )}

      {/* Details Modal */}
      {selectedItem && (
        <DetailsModal item={selectedItem} now={now} companies={companies} onClose={() => setSelectedItem(null)} />
      )}

      {/* Add/Edit Dialog */}
      {(addOpen || editingItem) && (
        <AddEditDialog
          form={form} setForm={setForm}
          companies={companies} saving={saving}
          isEdit={!!editingItem}
          previewUnits={previewUnits}
          onSave={handleSave} onClose={closeDialog}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border p-6 w-full max-w-sm shadow-lg">
            <h2 className="text-lg font-bold mb-2">تأكيد الحذف</h2>
            <p className="text-muted-foreground text-sm mb-5">هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">إلغاء</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 font-medium">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={cn("p-2 rounded-lg", bg, color)}>{icon}</div>
        <span className="text-xs text-muted-foreground text-right leading-tight max-w-[120px]">{label}</span>
      </div>
      <div>
        <p className={cn("text-xl font-bold font-mono", color)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Expenses Tab ──────────────────────────────────────────────────────────────

function ExpensesTab({ items, now, companies, onDetails, onEdit, onDelete }: {
  items: PrepaidItem[]; now: Date; companies: Company[];
  onDetails: (i: PrepaidItem) => void;
  onEdit: (i: PrepaidItem) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Receipt size={36} className="mx-auto mb-3 opacity-30" />
        <p>لا توجد مصروفات مقدمة</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map(item => {
        const schedule = buildSchedule(item);
        const company = item.company ?? companies.find(c => c.id === item.companyId);
        const companyColor = company?.color ?? "#0d9488";
        const totalMonths = schedule.length;

        const curMonthRow = schedule.find(r => isSameMonth(r.month, now));
        const elapsedIndex = schedule.findIndex(r => isSameMonth(r.month, now));
        const elapsedCount = elapsedIndex >= 0 ? elapsedIndex + 1 : schedule.filter(r => r.month < startOfMonth(now)).length;

        const consumed = schedule
          .filter(r => r.month <= startOfMonth(now))
          .reduce((s, r) => s + r.amount, 0);
        const remaining = item.amount - consumed;
        const pct = item.amount > 0 ? Math.min(Math.round((consumed / item.amount) * 100), 100) : 0;

        const typeColor = TYPE_COLORS[item.type] ?? "#6b7280";

        return (
          <div
            key={item.id}
            className="bg-card rounded-xl overflow-hidden hover:shadow-md transition-all"
            style={{
              border: "1px solid hsl(var(--border))",
              borderRightColor: companyColor,
              borderRightWidth: "4px",
            }}
          >
            <div className="p-4 space-y-3">
              {/* Row 1: name + status */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base truncate leading-snug">
                      {item.nameAr || item.vendorName}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                      item.status === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {item.status === "active" ? "نشط" : "مكتمل"}
                    </span>
                  </div>
                  {item.nameAr && item.vendorName && item.vendorName !== item.nameAr && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.vendorName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: companyColor }} />
                      <span className="text-xs font-medium" style={{ color: companyColor }}>{company?.name ?? "—"}</span>
                    </div>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: typeColor + "20", color: typeColor }}
                    >
                      {item.type}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar size={10} />
                      <span>
                        {format(new Date(item.startDate), "d MMM yyyy", { locale: ar })}
                        {" — "}
                        {format(new Date(item.endDate), "d MMM yyyy", { locale: ar })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current month box */}
              {curMonthRow && curMonthRow.amount > 0 && (
                <div className="rounded-lg px-3 py-2.5 flex items-center justify-between"
                  style={{ backgroundColor: companyColor + "15", border: `1px solid ${companyColor}30` }}>
                  <div>
                    <p className="text-xs font-medium" style={{ color: companyColor }}>نصيب هذا الشهر</p>
                    {curMonthRow.isPartial && (
                      <p className="text-xs text-muted-foreground">شهر جزئي · {curMonthRow.days} يوم</p>
                    )}
                  </div>
                  <p className="text-lg font-bold font-mono" style={{ color: companyColor }}>
                    {formatCurrency(curMonthRow.amount, item.currency as "SAR")}
                  </p>
                </div>
              )}

              {/* 3 amounts */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/30 rounded-lg py-2 px-1">
                  <p className="text-xs text-muted-foreground mb-1">الإجمالي</p>
                  <p className="text-sm font-bold font-mono">{formatCurrency(item.amount, item.currency as "SAR")}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg py-2 px-1">
                  <p className="text-xs text-amber-600 mb-1">المُطفأ</p>
                  <p className="text-sm font-bold font-mono text-amber-700 dark:text-amber-400">
                    {formatCurrency(consumed, item.currency as "SAR")}
                  </p>
                </div>
                <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg py-2 px-1">
                  <p className="text-xs text-violet-600 mb-1">المتبقي</p>
                  <p className="text-sm font-bold font-mono text-violet-700 dark:text-violet-400">
                    {formatCurrency(remaining, item.currency as "SAR")}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${companyColor}, ${companyColor}bb)`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>الشهر {elapsedCount} من {totalMonths}</span>
                  <span className="font-bold" style={{ color: companyColor }}>{pct}%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-1 border-t">
                <button onClick={() => onDetails(item)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 transition-colors font-medium">
                  <Eye size={12} /> تفاصيل
                </button>
                <button onClick={() => onEdit(item)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 transition-colors font-medium">
                  <Pencil size={12} /> تعديل
                </button>
                <button onClick={() => onDelete(item.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium mr-auto">
                  <Trash2 size={12} /> حذف
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Monthly Tab ───────────────────────────────────────────────────────────────

function MonthlyTab({ items, now }: { items: PrepaidItem[]; now: Date }) {
  const currentKey = format(now, "yyyy-MM");

  const monthGroups = useMemo(() => {
    if (items.length === 0) return [];
    type RowEntry = {
      item: PrepaidItem;
      amount: number;
      days: number;
      isPartial: boolean;
      monthIndex: number;
      totalMonths: number;
      totalExpenseDays: number;
      cumPct: number;
      remaining: number;
    };
    const map = new Map<string, { total: number; rows: RowEntry[] }>();
    for (const item of items) {
      const schedule = buildSchedule(item);
      const totalExpenseDays = differenceInCalendarDays(new Date(item.endDate), new Date(item.startDate)) + 1;
      schedule.forEach((row, idx) => {
        const key = format(row.month, "yyyy-MM");
        const prev = map.get(key) ?? { total: 0, rows: [] };
        const cumPct = Math.min(100, Math.round((row.cumulative / item.amount) * 100));
        prev.total += row.amount;
        prev.rows.push({
          item,
          amount: row.amount,
          days: row.days,
          isPartial: row.isPartial,
          monthIndex: idx + 1,
          totalMonths: schedule.length,
          totalExpenseDays,
          cumPct,
          remaining: Math.max(0, item.amount - row.cumulative),
        });
        map.set(key, prev);
      });
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, d]) => ({
        key,
        label: format(new Date(key + "-01"), "MMMM yyyy", { locale: ar }),
        total: d.total,
        rows: d.rows,
      }));
  }, [items]);

  if (monthGroups.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar size={36} className="mx-auto mb-3 opacity-30" />
        <p>لا توجد بيانات للجدول الشهري</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {monthGroups.map(group => {
        const isCurrent = group.key === currentKey;
        return (
          <div
            key={group.key}
            className={cn(
              "bg-card border rounded-xl overflow-hidden",
              isCurrent && "ring-2 ring-primary/25"
            )}
          >
            {/* Month header */}
            <div className={cn(
              "flex items-center justify-between px-4 py-3 border-b",
              isCurrent ? "bg-primary/5" : "bg-muted/30"
            )}>
              <div className="flex items-center gap-2">
                <Calendar size={15} className={isCurrent ? "text-primary" : "text-muted-foreground"} />
                <span className={cn("font-semibold text-sm", isCurrent && "text-primary")}>
                  {group.label}
                </span>
                {isCurrent && (
                  <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full font-medium">
                    الآن
                  </span>
                )}
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">تنصيب هذا الشهر</p>
                <p className={cn(
                  "font-bold font-mono text-sm",
                  isCurrent ? "text-primary" : "text-foreground"
                )}>
                  {formatCurrency(group.total, "SAR")} :ر.س
                </p>
              </div>
            </div>

            {/* Expense rows */}
            <div className="divide-y">
              {group.rows.map(({ item, amount, days, isPartial, monthIndex, totalMonths, totalExpenseDays, cumPct, remaining }) => {
                const company = item.company;
                const companyColor = company?.color ?? "#0d9488";
                const typeColor = TYPE_COLORS[item.type] ?? "#6b7280";
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Company color dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: companyColor }}
                    />

                    {/* Info block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {item.nameAr || item.vendorName}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={{ backgroundColor: typeColor + "20", color: typeColor }}
                        >
                          {item.type}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full shrink-0 font-medium",
                          isPartial
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        )}>
                          {isPartial ? `شهر جزئي · ${days} يوم` : "شهر كامل"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {company?.name ?? "—"} · الشهر {monthIndex} من {totalMonths} · {days} يوم من {totalExpenseDays}
                      </p>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${cumPct}%`, backgroundColor: companyColor }}
                        />
                      </div>
                    </div>

                    {/* Amount + remaining + pct */}
                    <div className="text-left shrink-0 min-w-[110px]">
                      <p className="font-bold font-mono text-sm">
                        {formatCurrency(amount, item.currency as "SAR")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        متبقي {formatCurrency(remaining, item.currency as "SAR")}
                      </p>
                      <p className="text-xs font-medium" style={{ color: companyColor }}>
                        {cumPct}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ items, companies, now }: { items: PrepaidItem[]; companies: Company[]; now: Date }) {
  const byYear = useMemo(() => {
    const map = new Map<string, { total: number; monthly: number; count: number }>();
    for (const item of items) {
      const yr = item.startDate.slice(0, 4);
      const prev = map.get(yr) ?? { total: 0, monthly: 0, count: 0 };
      map.set(yr, { total: prev.total + item.amount, monthly: prev.monthly + item.monthlyAmount, count: prev.count + 1 });
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([year, d]) => ({ year, ...d }));
  }, [items]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.type, (map.get(item.type) ?? 0) + item.amount);
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, amount]) => ({ name: type, type, value: amount, amount, pct: total > 0 ? (amount / total) * 100 : 0 }));
  }, [items]);

  const byCompany = useMemo(() => {
    const map = new Map<string, { name: string; total: number; consumed: number; color: string }>();
    for (const item of items) {
      const company = item.company ?? companies.find(c => c.id === item.companyId);
      const key = item.companyId;
      const prev = map.get(key) ?? { name: company?.name ?? "غير معروف", total: 0, consumed: 0, color: company?.color ?? "#0d9488" };
      map.set(key, {
        ...prev,
        total: prev.total + item.amount,
        consumed: prev.consumed + consumedUpToNow(item, now),
      });
    }
    return [...map.values()];
  }, [items, companies, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const grandTotal = items.reduce((s, i) => s + i.amount, 0);
  const grandMonthly = items.reduce((s, i) => s + i.monthlyAmount, 0);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 size={36} className="mx-auto mb-3 opacity-30" />
        <p>لا توجد بيانات للتحليل</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pie chart — category distribution */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">توزيع حسب التصنيف</h3>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={byType}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={85} innerRadius={40}
                paddingAngle={2}
                label={({ name, percent }) =>
                  percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {byType.map((entry) => (
                  <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? "#6b7280"} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v, "SAR")} />
              <Legend formatter={v => v} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart — company comparison */}
        <div className="bg-card border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">مقارنة الشركات (الإجمالي / المُطفأ)</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={byCompany} layout="vertical" margin={{ top: 0, right: 20, left: 4, bottom: 0 }}>
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
              <Tooltip formatter={(v: number) => formatCurrency(v, "SAR")} />
              <Bar dataKey="total" name="الإجمالي" radius={[0, 3, 3, 0]} maxBarSize={18}>
                {byCompany.map((entry) => <Cell key={entry.name + "-total"} fill={entry.color} />)}
              </Bar>
              <Bar dataKey="consumed" name="المُطفأ" radius={[0, 3, 3, 0]} maxBarSize={18}>
                {byCompany.map((entry) => <Cell key={entry.name + "-consumed"} fill={entry.color + "77"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Annual summary table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">الملخص السنوي</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/20">
            <tr>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">السنة</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">إجمالي المصروف</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">القسط الشهري</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">عدد المصروفات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {byYear.map(r => (
              <tr key={r.year} className="hover:bg-muted/20">
                <td className="px-4 py-2.5 font-medium">{r.year}</td>
                <td className="px-4 py-2.5 font-mono">{formatCurrency(r.total, "SAR")}</td>
                <td className="px-4 py-2.5 font-mono text-primary">{formatCurrency(r.monthly, "SAR")}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{r.count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="px-4 py-2.5 font-bold">الإجمالي</td>
              <td className="px-4 py-2.5 font-bold font-mono">{formatCurrency(grandTotal, "SAR")}</td>
              <td className="px-4 py-2.5 font-bold font-mono text-primary">{formatCurrency(grandMonthly, "SAR")}</td>
              <td className="px-4 py-2.5 text-right font-bold">{items.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Category progress bars */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-4">التوزيع حسب التصنيف</h3>
        <div className="space-y-3">
          {byType.map(({ type, amount, pct }) => (
            <div key={type} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium" style={{ color: TYPE_COLORS[type] ?? "#6b7280" }}>{type}</span>
                <div className="flex gap-3 text-muted-foreground">
                  <span className="font-mono">{formatCurrency(amount, "SAR")}</span>
                  <span className="w-10 text-left">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[type] ?? "#6b7280" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Forecasts Tab ─────────────────────────────────────────────────────────────

function ForecastsTab({ items, now }: { items: PrepaidItem[]; now: Date }) {
  const forecast = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const month = addMonths(startOfMonth(now), i);
      let total = 0;
      let count = 0;
      for (const item of items) {
        const schedule = buildSchedule(item);
        const row = schedule.find(r => isSameMonth(r.month, month));
        if (row) { total += row.amount; count++; }
      }
      result.push({
        label: format(month, "MMM yy", { locale: ar }),
        month: format(month, "MMMM yyyy", { locale: ar }),
        total: Math.round(total * 100) / 100,
        count,
      });
    }
    return result;
  }, [items, now]);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <TrendingDown size={36} className="mx-auto mb-3 opacity-30" />
        <p>لا توجد بيانات للتوقعات</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bar chart */}
      <div className="bg-card border rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-4">الأقساط المتوقعة — الـ 12 شهر القادمة</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={forecast} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip formatter={(v: number) => formatCurrency(v, "SAR")} labelFormatter={l => `الشهر: ${l}`} />
            <Bar dataKey="total" radius={[3, 3, 0, 0]}>
              {forecast.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الشهر</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">عدد المصروفات</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">إجمالي القسط</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {forecast.map((r, i) => (
              <tr key={r.month} className={cn("hover:bg-muted/20", i === 0 && "bg-primary/5")}>
                <td className="px-4 py-2.5 font-medium">
                  {r.month}
                  {i === 0 && <span className="mr-2 text-xs text-primary">(الشهر الحالي)</span>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.count}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-primary">{formatCurrency(r.total, "SAR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Details Modal ─────────────────────────────────────────────────────────────

function DetailsModal({ item, now, companies, onClose }: {
  item: PrepaidItem; now: Date; companies: Company[]; onClose: () => void;
}) {
  const schedule = useMemo(() => buildSchedule(item), [item]);
  const company = item.company ?? companies.find(c => c.id === item.companyId);
  const companyColor = company?.color ?? "#0d9488";

  const consumed = schedule.filter(r => r.month <= startOfMonth(now)).reduce((s, r) => s + r.amount, 0);
  const remaining = item.amount - consumed;
  const pct = item.amount > 0 ? Math.round((consumed / item.amount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl border w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-lg">{item.nameAr || item.vendorName}</h2>
            {item.nameAr && item.vendorName !== item.nameAr && (
              <p className="text-sm text-muted-foreground">{item.vendorName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">الإجمالي</p>
              <p className="font-bold font-mono">{formatCurrency(item.amount, item.currency as "SAR")}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">القسط الأساسي / وحدة</p>
              <p className="font-bold font-mono text-primary">{formatCurrency(item.monthlyAmount, item.currency as "SAR")}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">الفترة</p>
              <p className="font-medium text-sm">{item.startDate.slice(0, 10)} → {item.endDate.slice(0, 10)}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-amber-600">مُطفأ: {formatCurrency(consumed, item.currency as "SAR")}</span>
              <span className="text-violet-600">متبقي: {formatCurrency(remaining, item.currency as "SAR")}</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: companyColor }} />
            </div>
            <p className="text-xs text-muted-foreground text-center">{pct}% مُطفأ</p>
          </div>

          {/* Amortization table */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">الشهر</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">الأيام</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">القسط</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">التراكمي</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {schedule.map((row, idx) => {
                  const isCurrent = isSameMonth(row.month, now);
                  const isPast = row.month < startOfMonth(now);
                  return (
                    <tr key={idx} className={cn(
                      isCurrent && "bg-emerald-50 dark:bg-emerald-900/20",
                      isPast && !isCurrent && "opacity-60"
                    )}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                          <span className={cn("font-medium", isCurrent && "text-emerald-700 dark:text-emerald-400")}>
                            {format(row.month, "MMMM yyyy", { locale: ar })}
                          </span>
                        </div>
                        {row.isPartial && (
                          <span className="text-xs text-amber-600">شهر جزئي · {row.days} يوم</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.days}</td>
                      <td className="px-3 py-2 font-mono">{formatCurrency(row.amount, item.currency as "SAR")}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{formatCurrency(row.cumulative, item.currency as "SAR")}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td className="px-3 py-2 font-bold" colSpan={2}>الإجمالي</td>
                  <td className="px-3 py-2 font-bold font-mono" colSpan={2}>{formatCurrency(item.amount, item.currency as "SAR")}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add/Edit Dialog ───────────────────────────────────────────────────────────

type FormState = {
  vendorName: string; nameAr: string; companyId: string; type: string;
  currency: string; amount: string; startDate: string; endDate: string; description: string;
};

function AddEditDialog({ form, setForm, companies, saving, isEdit, previewUnits, onSave, onClose }: {
  form: FormState;
  setForm: (f: FormState) => void;
  companies: Company[];
  saving: boolean;
  isEdit: boolean;
  previewUnits: { units: string; months: number; baseRate: number } | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const inp = "w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl border p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{isEdit ? "تعديل مصروف مقدم" : "إضافة مصروف مقدم"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">اسم المصروف *</label>
              <input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })}
                placeholder="مثال: إيجار المكتب السنوي" className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">اسم المورد / الجهة</label>
              <input value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })}
                placeholder="e.g. Insurance Co." className={inp} />
            </div>
          </div>

          {/* Company + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">الشركة *</label>
              <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className={inp}>
                <option value="">اختر الشركة...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">التصنيف</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inp}>
                {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-muted-foreground block mb-1">المبلغ الإجمالي *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00" className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">العملة</label>
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className={inp}>
                {["SAR", "USD", "EUR", "AED"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">من تاريخ *</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">إلى تاريخ *</label>
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={inp} />
            </div>
          </div>

          {/* Live preview */}
          {previewUnits && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">عدد الأشهر</p>
                  <p className="font-bold">{previewUnits.months}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">إجمالي الوحدات</p>
                  <p className="font-bold">{previewUnits.units}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">القسط الأساسي</p>
                  <p className="font-bold text-primary">{formatCurrency(previewUnits.baseRate, form.currency as "SAR")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">الوصف</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="وصف اختياري..." className={inp} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">إلغاء</button>
          <button onClick={onSave} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 font-medium disabled:opacity-60">
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة"}
          </button>
        </div>
      </div>
    </div>
  );
}
