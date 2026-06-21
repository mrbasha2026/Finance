"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, Save, RefreshCw } from "lucide-react";
import { inferDynamic } from "@/lib/pnl-calculations";
import { formatCurrency } from "@/lib/format";
import { Company } from "@/lib/pnl-types";
import { DynamicCategory, catKey, isLeaf, FORMULA_KEYS } from "@/lib/category-types";
import { cn } from "@/lib/utils";

interface CompanyOption extends Company { id: string }

// Build a tree from a flat list (already ordered by sortOrder)
function buildTree(flat: DynamicCategory[]): DynamicCategory[] {
  const map = new Map<string, DynamicCategory>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: DynamicCategory[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else if (!c.parentId) {
      roots.push(node);
    }
  });
  return roots;
}

// Collect all leaf nodes in display order (DFS)
function collectLeaves(nodes: DynamicCategory[]): DynamicCategory[] {
  const result: DynamicCategory[] = [];
  function dfs(node: DynamicCategory) {
    if (isLeaf(node)) { result.push(node); return; }
    node.children.forEach(dfs);
  }
  nodes.forEach(dfs);
  return result;
}

// Group leaf nodes by their root ancestor for form sections
function buildSections(roots: DynamicCategory[]): { cat: DynamicCategory; leaves: DynamicCategory[] }[] {
  return roots
    .filter((r) => !FORMULA_KEYS.has(r.pnlKey ?? ""))
    .map((root) => ({ cat: root, leaves: collectLeaves([root]) }))
    .filter((s) => s.leaves.length > 0);
}

export function PnLManualForm() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [allCategories, setAllCategories] = useState<DynamicCategory[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [period, setPeriod] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [values, setValues] = useState<Record<string, string>>({});
  const [calculated, setCalculated] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [zakatRate, setZakatRate] = useState(0.025);
  const [loading, setLoading] = useState(true);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/companies").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/pnl/save-batch").then((r) => r.json()),
    ]).then(([comp, cats, settings, pnl]) => {
      setCompanies(comp.companies ?? []);
      setAllCategories(cats.categories ?? []);
      if (settings.zakatRate) setZakatRate(settings.zakatRate);
      const keys = new Set<string>(
        (pnl.datasets ?? []).map((d: { companyId: string; period: string }) => `${d.companyId}_${d.period}`)
      );
      setExistingKeys(keys);
      setLoading(false);
    });
  }, []);

  const roots = buildTree(allCategories);

  const recalculate = useCallback(() => {
    const raw: Record<string, number> = {};
    for (const [key, val] of Object.entries(values)) {
      raw[key] = parseFloat(val) || 0;
    }
    setCalculated(inferDynamic(raw, allCategories, zakatRate));
  }, [values, allCategories, zakatRate]);

  useEffect(() => { recalculate(); }, [recalculate]);

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function toggleSection(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleSave() {
    if (!companyId) { toast.error("اختر الشركة"); return; }
    if (!period) { toast.error("اختر الفترة"); return; }
    if (existingKeys.has(`${companyId}_${period}`)) {
      setShowDuplicateDialog(true);
      return;
    }
    doSave("replace");
  }

  async function doSave(mode: "merge" | "replace") {
    const company = companies.find((c) => c.id === companyId);
    if (!company) return;
    const lineItems = Object.entries(calculated).map(([key, amount]) => ({ key, amount }));
    setSaving(true);
    const res = await fetch("/api/pnl/save-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasets: [{ companyId, companyName: company.name, period, currency, lineItems, mode }] }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(mode === "merge" ? "تم دمج البيانات بنجاح" : "تم استبدال البيانات بنجاح");
      setValues({});
      setCalculated({});
    } else {
      toast.error("حدث خطأ أثناء الحفظ");
    }
  }

  const rev = calculated["revenue"] ?? 0;
  const gp = calculated["gross_profit"] ?? 0;
  const oi = calculated["operating_income"] ?? 0;
  const ni = calculated["net_income"] ?? 0;

  const sections = buildSections(roots);

  if (loading) return <div className="py-12 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      {showDuplicateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDuplicateDialog(false)}>
          <div className="bg-card rounded-2xl border p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2">بيانات موجودة مسبقاً</h3>
            <p className="text-sm text-muted-foreground mb-6">
              يوجد إدخال لهذه الشركة وهذه الفترة. كيف تريد المتابعة؟
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { setShowDuplicateDialog(false); doSave("merge"); }}
                className="w-full px-4 py-2.5 text-sm rounded-lg font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                دمج — إضافة القيم الجديدة مع الاحتفاظ بالقديمة
              </button>
              <button
                onClick={() => { setShowDuplicateDialog(false); doSave("replace"); }}
                className="w-full px-4 py-2.5 text-sm rounded-lg font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
              >
                استبدال — حذف البيانات القديمة والكتابة فوقها
              </button>
              <button
                onClick={() => setShowDuplicateDialog(false)}
                className="w-full px-4 py-2.5 text-sm rounded-lg border hover:bg-muted transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-card rounded-xl border">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">الشركة *</label>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">اختر الشركة...</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">الفترة *</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">العملة</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
            {["SAR", "USD", "EUR", "AED", "KWD"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Live calculated summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "الإيرادات", value: rev, color: "text-blue-600" },
          { label: "إجمالي الربح", value: gp, color: gp >= 0 ? "text-emerald-600" : "text-red-500" },
          { label: "الدخل التشغيلي", value: oi, color: oi >= 0 ? "text-emerald-600" : "text-red-500" },
          { label: "صافي الدخل", value: ni, color: ni >= 0 ? "text-emerald-600" : "text-red-500" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className={cn("text-lg font-bold", item.color)}>
              {formatCurrency(item.value, currency as "SAR", true)}
            </p>
          </div>
        ))}
      </div>

      {/* Dynamic input sections */}
      <div className="space-y-3">
        {sections.map(({ cat, leaves }) => {
          const isCollapsed = collapsed[cat.id];
          return (
            <div key={cat.id} className="rounded-xl border bg-card overflow-hidden">
              <button onClick={() => toggleSection(cat.id)}
                className="w-full flex items-center justify-between px-4 py-3 font-semibold text-sm hover:bg-muted/50 transition-colors">
                <span>{cat.nameAr}</span>
                <div className="flex items-center gap-3">
                  {calculated[catKey(cat)] !== undefined && (
                    <span className={cn("text-xs font-mono", calculated[catKey(cat)] >= 0 ? "text-emerald-600" : "text-red-500")}>
                      {formatCurrency(calculated[catKey(cat)], currency as "SAR", true)}
                    </span>
                  )}
                  {isCollapsed ? <ChevronLeft size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="border-t px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {leaves.map((item) => (
                    <div key={item.id}>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        {item.nameAr}
                        <span className="font-normal text-muted-foreground/70 mr-1">· {item.name}</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number" min="0" step="0.01"
                          value={values[catKey(item)] ?? ""}
                          onChange={(e) => setValue(catKey(item), e.target.value)}
                          placeholder="0.00"
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 pl-12"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{currency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => { setValues({}); setCalculated({}); }}
          className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-muted">
          <RefreshCw size={14} /> إعادة تعيين
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
          <Save size={14} />
          {saving ? "جارٍ الحفظ..." : "حفظ البيانات"}
        </button>
      </div>
    </div>
  );
}
