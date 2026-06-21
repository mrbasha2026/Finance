"use client";

import { useState, useEffect, Fragment } from "react";
import { toast } from "sonner";
import { Trash2, Search, Plus, X, Check, Loader2 } from "lucide-react";

interface Mapping {
  label:  string;
  pnlKey: string;
}

interface LeafCategory {
  pnlKey: string;
  nameAr: string;
  name:   string;
}

interface ApiCategory {
  pnlKey:   string | null;
  nameAr:   string;
  name:     string;
  children: ApiCategory[];
}

const TYPE_LABELS: Record<string, string> = {
  revenue: "إيراد",
  expense: "مصروف",
  profit:  "ربح (محسوب)",
};

function extractLeaves(cats: ApiCategory[]): LeafCategory[] {
  const result: LeafCategory[] = [];
  function dfs(c: ApiCategory) {
    if (!c.children?.length && c.pnlKey) {
      result.push({ pnlKey: c.pnlKey, nameAr: c.nameAr, name: c.name });
    }
    c.children?.forEach(dfs);
  }
  cats.forEach(dfs);
  return result;
}

interface NewCatForm {
  nameAr: string;
  name:   string;
  type:   string;
}

const EMPTY_FORM: NewCatForm = { nameAr: "", name: "", type: "expense" };

export function LabelMappingsTab() {
  const [mappings,    setMappings]    = useState<Mapping[]>([]);
  const [categories,  setCategories]  = useState<LeafCategory[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [addingFor,   setAddingFor]   = useState<string | null>(null); // pnlKey being fixed
  const [newCatForm,  setNewCatForm]  = useState<NewCatForm>(EMPTY_FORM);
  const [creating,    setCreating]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/pnl/label-mappings").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([maps, cats]) => {
      const entries = Object.entries(maps.mappings ?? {}) as [string, string][];
      setMappings(entries.map(([label, pnlKey]) => ({ label, pnlKey })));
      setCategories(extractLeaves(cats.categories ?? []));
      setLoading(false);
    });
  }, []);

  async function handleChange(label: string, newKey: string) {
    if (!newKey) return;
    const res = await fetch("/api/pnl/label-mappings", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ mappings: { [label]: newKey } }),
    });
    if (res.ok) {
      setMappings((prev) => prev.map((m) => m.label === label ? { ...m, pnlKey: newKey } : m));
      toast.success("تم تحديث الربط");
    } else {
      toast.error("حدث خطأ أثناء التحديث");
    }
  }

  async function handleDelete(label: string) {
    const res = await fetch("/api/pnl/label-mappings", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ label }),
    });
    if (res.ok) {
      setMappings((prev) => prev.filter((m) => m.label !== label));
      toast.success("تم حذف الربط");
    } else {
      toast.error("حدث خطأ أثناء الحذف");
    }
  }

  function openAddForm(pnlKey: string) {
    setAddingFor(pnlKey);
    setNewCatForm({ nameAr: "", name: pnlKey, type: "expense" });
  }

  function closeAddForm() {
    setAddingFor(null);
    setNewCatForm(EMPTY_FORM);
  }

  async function handleCreateCategory() {
    if (!addingFor) return;
    if (!newCatForm.nameAr.trim() || !newCatForm.name.trim()) {
      toast.error("الاسم العربي والإنجليزي مطلوبان");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/categories", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:   newCatForm.name.trim(),
        nameAr: newCatForm.nameAr.trim(),
        type:   newCatForm.type,
        pnlKey: addingFor,
      }),
    });
    setCreating(false);
    if (res.ok) {
      const { category } = await res.json();
      setCategories((prev) => [...prev, { pnlKey: category.pnlKey, nameAr: category.nameAr, name: category.name }]);
      toast.success(`تم إنشاء التصنيف "${category.nameAr}"`);
      closeAddForm();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "حدث خطأ أثناء الإنشاء");
    }
  }

  const filtered = mappings.filter(
    (m) =>
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.pnlKey.toLowerCase().includes(search.toLowerCase()) ||
      (categories.find((c) => c.pnlKey === m.pnlKey)?.nameAr ?? "").includes(search)
  );

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">فهرس الربط</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mappings.length} ربط محفوظ · يتم التحديث فوراً عند التغيير
          </p>
        </div>
        <div className="relative w-64">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بكود الحساب أو التصنيف..."
            className="w-full border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 pr-8"
          />
        </div>
      </div>

      {mappings.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm rounded-xl border border-dashed">
          لا توجد ربطات محفوظة بعد — تُضاف تلقائياً عند رفع ملف Excel وتأكيد الربط
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground w-2/5">
                  كود / اسم الحساب
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                  التصنيف المرتبط
                </th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((m) => {
                const cat        = categories.find((c) => c.pnlKey === m.pnlKey);
                const isOrphaned = !cat;
                const isAdding   = addingFor === m.pnlKey;

                return (
                  <Fragment key={m.label}>
                    <tr className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{m.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={isOrphaned ? "" : m.pnlKey}
                          onChange={(e) => handleChange(m.label, e.target.value)}
                          className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          {isOrphaned && (
                            <option value="" disabled>
                              — تصنيف غير موجود: {m.pnlKey} —
                            </option>
                          )}
                          {categories.map((c) => (
                            <option key={c.pnlKey} value={c.pnlKey}>
                              {c.nameAr} — {c.pnlKey}
                            </option>
                          ))}
                        </select>
                        {isOrphaned && !isAdding && (
                          <button
                            onClick={() => openAddForm(m.pnlKey)}
                            className="mt-1.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            <Plus size={11} /> إضافة تصنيف جديد بهذا المفتاح
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(m.label)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="حذف الربط"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>

                    {isAdding && (
                      <tr className="bg-primary/5 border-b border-primary/20">
                        <td colSpan={3} className="px-4 py-3">
                          <div className="flex items-end gap-2 flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                              <label className="text-[10px] text-muted-foreground block mb-1">الاسم بالعربي *</label>
                              <input
                                autoFocus
                                value={newCatForm.nameAr}
                                onChange={(e) => setNewCatForm((p) => ({ ...p, nameAr: e.target.value }))}
                                placeholder="مثال: إيرادات المبيعات"
                                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                              />
                            </div>
                            <div className="flex-1 min-w-[120px]">
                              <label className="text-[10px] text-muted-foreground block mb-1">الاسم بالإنجليزي *</label>
                              <input
                                value={newCatForm.name}
                                onChange={(e) => setNewCatForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="مثال: sales_revenue"
                                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                              />
                            </div>
                            <div className="w-36">
                              <label className="text-[10px] text-muted-foreground block mb-1">النوع</label>
                              <select
                                value={newCatForm.type}
                                onChange={(e) => setNewCatForm((p) => ({ ...p, type: e.target.value }))}
                                className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                              >
                                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-1.5 pb-0.5">
                              <button
                                onClick={handleCreateCategory}
                                disabled={creating}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
                              >
                                {creating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                إنشاء
                              </button>
                              <button
                                onClick={closeAddForm}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg hover:bg-muted"
                              >
                                <X size={11} /> إلغاء
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            سيُنشأ التصنيف بمفتاح <span className="font-mono text-primary">{m.pnlKey}</span>
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && search && (
            <p className="text-center text-xs text-muted-foreground py-6">لا توجد نتائج لـ "{search}"</p>
          )}
        </div>
      )}
    </div>
  );
}
