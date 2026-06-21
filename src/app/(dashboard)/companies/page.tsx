"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Company } from "@/lib/pnl-types";
import { SkeletonTable } from "@/components/shared/SkeletonLoaders";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const COLORS = [
  "#0d9488", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f97316", "#eab308", "#10b981", "#06b6d4",
  "#ef4444", "#f43f5e", "#6366f1", "#a855f7",
  "#84cc16", "#14b8a6", "#d97706", "#0ea5e9",
  "#64748b", "#b45309", "#1d4ed8", "#7c3aed",
];

interface CompanyWithStats extends Company {
  _count?: { pnlDatasets: number };
  lastPeriod?: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyWithStats | null>(null);
  const [form, setForm] = useState({ name: "", color: COLORS[0], currency: "SAR" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/companies");
    const data = await res.json();
    setCompanies(
      data.companies.map((c: CompanyWithStats & { pnlDatasets?: { period: string }[] }) => ({
        ...c,
        createdAt: c.createdAt ?? "",
        lastPeriod: c.pnlDatasets?.[0]?.period,
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", color: COLORS[0], currency: "SAR" });
    setDialogOpen(true);
  }

  function openEdit(c: CompanyWithStats) {
    setEditing(c);
    setForm({ name: c.name, color: c.color, currency: c.currency });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("اسم الشركة مطلوب"); return; }
    setSaving(true);

    const url = editing ? `/api/companies/${editing.id}` : "/api/companies";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);

    if (res.ok) {
      toast.success(editing ? "تم تحديث الشركة" : "تمت إضافة الشركة");
      setDialogOpen(false);
      load();
    } else {
      toast.error("حدث خطأ");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok) { toast.success("تم حذف الشركة"); load(); }
    else toast.error("حدث خطأ أثناء الحذف");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 size={22} className="text-primary" /> إدارة الشركات
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{companies.length} شركة مسجلة</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={16} /> إضافة شركة
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">الشركة</th>
                <th className="text-right px-4 py-3 font-semibold">العملة</th>
                <th className="text-right px-4 py-3 font-semibold">عدد الفترات</th>
                <th className="text-right px-4 py-3 font-semibold">آخر تحديث</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="font-medium" style={{ color: c.color }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.currency}</td>
                  <td className="px-4 py-3">{c._count?.pnlDatasets ?? 0} فترة</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.lastPeriod ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 hover:bg-muted rounded text-muted-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    لا توجد شركات مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl border p-6 w-full max-w-md mx-4 shadow-lg">
            <h2 className="text-lg font-bold mb-4">
              {editing ? "تعديل الشركة" : "إضافة شركة جديدة"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">اسم الشركة *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: شركة الأمل للتجارة"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">العملة</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                >
                  {["SAR", "USD", "EUR", "AED", "KWD"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">لون الشركة</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`اختر اللون ${color}`}
                      aria-pressed={form.color === color}
                      onClick={() => setForm({ ...form, color })}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: color,
                        borderColor: form.color === color ? "#000" : "transparent",
                        outline: form.color === color ? "2px solid var(--ring)" : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 font-medium disabled:opacity-60 disabled:pointer-events-none"
              >
                {saving ? "جارٍ الحفظ..." : (editing ? "حفظ التغييرات" : "إضافة")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف الشركة"
        description="هل أنت متأكد من حذف هذه الشركة وجميع بياناتها؟ لا يمكن التراجع."
        confirmLabel="حذف"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
