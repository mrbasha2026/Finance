"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Tags, Trash2, ChevronDown, ChevronLeft, Pencil, GripVertical, X, Check } from "lucide-react";
import { SkeletonTable } from "@/components/shared/SkeletonLoaders";
import { DynamicCategory, FORMULA_KEYS, SYSTEM_KEYS } from "@/lib/category-types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  nameAr: string;
  type: string;
  parentId: string;
  isCalculated: boolean;
  isTotal: boolean;
  isSubtotal: boolean;
}

const EMPTY_FORM: FormState = {
  name: "", nameAr: "", type: "expense",
  parentId: "", isCalculated: false, isTotal: false, isSubtotal: false,
};

const TYPE_LABELS: Record<string, string> = {
  revenue: "إيراد",
  expense: "مصروف",
  profit: "ربح (محسوب)",
};

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function buildTree(flat: DynamicCategory[]): DynamicCategory[] {
  const map = new Map<string, DynamicCategory>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: DynamicCategory[] = [];
  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) map.get(c.parentId)!.children.push(node);
    else if (!c.parentId) roots.push(node);
  });
  return roots;
}

// ─── Row component ────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  depth,
  onDelete,
  onEdit,
  onAdd,
  expanded,
  onToggle,
}: {
  cat: DynamicCategory;
  depth: number;
  onDelete: (id: string) => void;
  onEdit: (cat: DynamicCategory) => void;
  onAdd: (parentId: string) => void;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = cat.children.length > 0;
  const isFormula = FORMULA_KEYS.has(cat.pnlKey ?? "");
  const isSystem  = SYSTEM_KEYS.has(cat.pnlKey ?? "");
  const isOpen = expanded[cat.id] ?? true;

  return (
    <>
      <tr className={cn(
        "border-b group transition-colors hover:bg-muted/30",
        depth === 0 && "bg-muted/10",
        cat.isTotal && "font-bold",
        cat.isSubtotal && "font-semibold",
      )}>
        <td className="px-3 py-2.5" style={{ paddingRight: `${(depth + 1) * 20}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button onClick={() => onToggle(cat.id)} className="text-muted-foreground hover:text-foreground shrink-0">
                {isOpen ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
              </button>
            ) : (
              <span className="w-[14px] shrink-0 block" />
            )}
            <span className="text-sm">{cat.nameAr}</span>
            {isFormula && (
              <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-medium">
                معادلة
              </span>
            )}
            {isSystem && !isFormula && (
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                أساسي
              </span>
            )}
            {hasChildren && !isFormula && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">
                مجموع أبناء
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-sm text-muted-foreground">{cat.name}</td>
        <td className="px-3 py-2.5">
          <span className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium",
            cat.type === "revenue" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
            cat.type === "expense" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" :
            "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
          )}>
            {TYPE_LABELS[cat.type] ?? cat.type}
          </span>
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{cat.pnlKey ?? "—"}</td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isFormula && (
              <button
                onClick={() => onAdd(cat.id)}
                title="إضافة بند فرعي"
                className="p-1.5 hover:bg-primary/10 rounded text-primary"
              >
                <Plus size={13} />
              </button>
            )}
            <button
              onClick={() => onEdit(cat)}
              title="تعديل"
              className="p-1.5 hover:bg-muted rounded text-muted-foreground"
            >
              <Pencil size={13} />
            </button>
            {!isSystem && (
              <button
                onClick={() => onDelete(cat.id)}
                title="حذف"
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-red-500"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {hasChildren && isOpen &&
        cat.children.map((child) => (
          <CategoryRow
            key={child.id}
            cat={child}
            depth={depth + 1}
            onDelete={onDelete}
            onEdit={onEdit}
            onAdd={onAdd}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))
      }
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [flat, setFlat] = useState<DynamicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DynamicCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [parentSearch, setParentSearch] = useState("");
  const [parentOpen, setParentOpen] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/categories");
    const { categories } = await res.json();
    setFlat(categories ?? []);
    // Default: all roots expanded
    const init: Record<string, boolean> = {};
    (categories as DynamicCategory[])?.forEach((c) => { if (!c.parentId) init[c.id] = true; });
    setExpanded((prev) => ({ ...init, ...prev }));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd(parentId = "") {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, parentId });
    setParentSearch("");
    setParentOpen(false);
    setDialogOpen(true);
  }

  function openEdit(cat: DynamicCategory) {
    setEditTarget(cat);
    setForm({
      name: cat.name,
      nameAr: cat.nameAr,
      type: cat.type,
      parentId: cat.parentId ?? "",
      isCalculated: cat.isCalculated,
      isTotal: cat.isTotal,
      isSubtotal: cat.isSubtotal,
    });
    setParentSearch("");
    setParentOpen(false);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.nameAr) { toast.error("أدخل الاسم باللغتين"); return; }

    const body = {
      name: form.name,
      nameAr: form.nameAr,
      type: form.type,
      parentId: form.parentId || null,
      isCalculated: form.isCalculated,
      isTotal: form.isTotal,
      isSubtotal: form.isSubtotal,
    };

    let res: Response;
    if (editTarget) {
      res = await fetch(`/api/categories/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (res.ok) {
      toast.success(editTarget ? "تم التعديل" : "تمت الإضافة");
      setDialogOpen(false);
      load();
    } else {
      toast.error("حدث خطأ");
    }
  }

  async function handleDelete(id: string) {
    const cat = flat.find((c) => c.id === id);
    if (!confirm(`حذف "${cat?.nameAr}"؟ سيتم نقل البنود الفرعية إلى المستوى الأعلى.`)) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("تم الحذف"); load(); }
    else toast.error("حدث خطأ");
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const roots = buildTree(flat);
  const nonFormula = flat.filter((c) => !FORMULA_KEYS.has(c.pnlKey ?? ""));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tags size={22} className="text-primary" /> التصنيفات والأقسام
        </h1>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> إضافة بند
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground p-3 bg-muted/30 rounded-xl">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> بنود بمعادلة ثابتة (لا تُحذف)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> بنود أساسية للنظام (لا تُحذف — يمكن تعديل الاسم)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> بنود تُجمع تلقائياً من أبنائها
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" /> بنود الإدخال (أوراق الشجرة)
        </span>
      </div>

      {/* Table */}
      {loading ? <SkeletonTable rows={8} /> : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-right px-3 py-3 font-semibold">الاسم بالعربية</th>
                <th className="text-right px-3 py-3 font-semibold">الاسم بالإنجليزية</th>
                <th className="text-right px-3 py-3 font-semibold">النوع</th>
                <th className="text-right px-3 py-3 font-semibold">المفتاح</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {roots.map((root) => (
                <CategoryRow
                  key={root.id}
                  cat={root}
                  depth={0}
                  onDelete={handleDelete}
                  onEdit={openEdit}
                  onAdd={openAdd}
                  expanded={expanded}
                  onToggle={toggleExpanded}
                />
              ))}
              {roots.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    لا توجد تصنيفات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border p-6 w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editTarget ? "تعديل البند" : "إضافة بند جديد"}</h2>
              <button onClick={() => setDialogOpen(false)} className="p-1.5 rounded hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">الاسم بالعربية *</label>
                <input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder="مصروفات التسويق"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">الاسم بالإنجليزية *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Marketing Expenses"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">النوع</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="revenue">إيراد</option>
                  <option value="expense">مصروف</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">تحت بند (اختياري)</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setParentOpen((o) => !o); setParentSearch(""); }}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background text-right flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <span className={cn(!form.parentId ? "text-muted-foreground" : "")}>
                      {nonFormula.find((c) => c.id === form.parentId)?.nameAr ?? "— بند رئيسي (بدون أب) —"}
                    </span>
                    <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                  </button>
                  {parentOpen && (
                    <>
                      <div className="fixed inset-0 z-[59]" onClick={() => setParentOpen(false)} />
                      <div className="absolute z-[60] mt-1 w-full bg-card border rounded-lg shadow-lg overflow-hidden">
                        <div className="p-2 border-b">
                          <input
                            autoFocus
                            value={parentSearch}
                            onChange={(e) => setParentSearch(e.target.value)}
                            placeholder="بحث..."
                            className="w-full px-3 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {!parentSearch && (
                            <button
                              type="button"
                              onClick={() => { setForm({ ...form, parentId: "" }); setParentOpen(false); }}
                              className={cn(
                                "w-full text-right px-3 py-2 text-sm hover:bg-muted transition-colors block text-muted-foreground",
                                !form.parentId && "bg-primary/10 text-primary font-medium"
                              )}
                            >
                              — بند رئيسي (بدون أب) —
                            </button>
                          )}
                          {nonFormula
                            .filter((c) =>
                              c.nameAr.includes(parentSearch) ||
                              c.name.toLowerCase().includes(parentSearch.toLowerCase())
                            )
                            .map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => { setForm({ ...form, parentId: c.id }); setParentOpen(false); }}
                                className={cn(
                                  "w-full text-right px-3 py-2 text-sm hover:bg-muted transition-colors block",
                                  c.parentId && "pr-6",
                                  form.parentId === c.id && "bg-primary/10 text-primary font-medium"
                                )}
                              >
                                {c.nameAr}
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-3 pt-1">
                {([
                  { key: "isTotal", label: "إجمالي رئيسي (bold)" },
                  { key: "isSubtotal", label: "إجمالي فرعي" },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <span
                      onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        form[key] ? "bg-primary border-primary text-white" : "border-border"
                      )}
                    >
                      {form[key] && <Check size={11} />}
                    </span>
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">
                إلغاء
              </button>
              <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 font-medium">
                {editTarget ? "حفظ التعديلات" : "إضافة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
