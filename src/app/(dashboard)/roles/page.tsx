"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Plus, Trash2, Save } from "lucide-react";
import { ALL_PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";
import { SkeletonTable } from "@/components/shared/SkeletonLoaders";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("fetch failed");
      const { roles: r } = await res.json();
      setRoles(r ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function selectRole(r: Role) {
    setSelected(r);
    setEditPerms(r.permissions);
    setCreating(false);
  }

  function togglePerm(perm: string) {
    setEditPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/roles/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: editPerms }),
    });
    setSaving(false);
    if (res.ok) { toast.success("تم حفظ الصلاحيات"); load(); }
    else toast.error("حدث خطأ");
  }

  async function handleCreate() {
    if (!newName.trim()) { toast.error("أدخل اسم الدور"); return; }
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, permissions: editPerms }),
    });
    if (res.ok) { toast.success("تم إنشاء الدور"); setCreating(false); setNewName(""); load(); }
    else toast.error("حدث خطأ");
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok) { toast.success("تم الحذف"); load(); setSelected(null); }
    else toast.error("حدث خطأ");
  }

  // Group permissions by prefix
  const permGroups = [
    { label: "بيانات P&L", perms: ALL_PERMISSIONS.filter((p) => p.startsWith("pnl.")) },
    { label: "الشركات", perms: ALL_PERMISSIONS.filter((p) => p.startsWith("companies.")) },
    { label: "المستخدمون", perms: ALL_PERMISSIONS.filter((p) => p.startsWith("users.")) },
    { label: "الأدوار", perms: ALL_PERMISSIONS.filter((p) => p.startsWith("roles.")) },
    { label: "النظام", perms: ALL_PERMISSIONS.filter((p) => p.startsWith("system.")) },
    { label: "المصروفات", perms: ALL_PERMISSIONS.filter((p) => p.startsWith("expenses.") || p.startsWith("prepaid.")) },
    { label: "التنبؤات", perms: ALL_PERMISSIONS.filter((p) => p.startsWith("forecasts.")) },
  ].filter((g) => g.perms.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" /> الأدوار والصلاحيات
        </h1>
        <button
          onClick={() => { setCreating(true); setSelected(null); setEditPerms([]); setNewName(""); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> دور جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Roles list */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 font-semibold text-sm">الأدوار</div>
          {loading ? <div className="p-4"><SkeletonTable rows={3} /></div> : error ? <ErrorState onRetry={load} /> : (
            <div className="divide-y">
              {roles.map((r) => (
                <div
                  key={r.id}
                  onClick={() => selectRole(r)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    selected?.id === r.id ? "bg-primary/5 border-r-2 border-primary" : ""
                  )}
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.permissions.length} صلاحية</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.id); }}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions matrix */}
        <div className="lg:col-span-2 rounded-xl border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <span className="font-semibold text-sm">
              {creating ? "إنشاء دور جديد" : selected ? `صلاحيات: ${selected.name}` : "اختر دوراً"}
            </span>
            {(selected || creating) && (
              <button
                onClick={creating ? handleCreate : handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <Save size={12} />
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            )}
          </div>

          {creating && (
            <div className="px-4 py-3 border-b">
              <label className="text-xs font-semibold text-muted-foreground block mb-1">اسم الدور *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: محاسب"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {(selected || creating) ? (
            <div className="p-4 space-y-4">
              {permGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.perms.map((perm) => (
                      <label
                        key={perm}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editPerms.includes(perm)}
                          onChange={() => togglePerm(perm)}
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <span className="text-sm">{PERMISSION_LABELS[perm as keyof typeof PERMISSION_LABELS]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              اختر دوراً من القائمة لعرض وتعديل صلاحياته
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف الدور"
        description="هل أنت متأكد من حذف هذا الدور؟ سيفقد المستخدمون المرتبطون به صلاحياتهم."
        confirmLabel="حذف"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
