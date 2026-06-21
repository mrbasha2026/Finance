"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Trash2, Shield, ShieldOff, Pencil, UserX, UserCheck, ShieldAlert } from "lucide-react";
import { SkeletonTable } from "@/components/shared/SkeletonLoaders";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";

interface User {
  id: string;
  email: string;
  name: string;
  twoFactorEnabled: boolean;
  twoFactorForced: boolean;
  isActive: boolean;
  createdAt: string;
  userRoles: { role: { id: string; name: string } }[];
}
interface Role { id: string; name: string; }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", roleId: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", roleId: "" });

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const [uRes, rRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/roles"),
      ]);
      if (!uRes.ok || !rRes.ok) throw new Error("fetch failed");
      const { users: u } = await uRes.json();
      const { roles: r } = await rRes.json();
      setUsers(u ?? []);
      setRoles(r ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.email || !form.name || !form.password || !form.roleId) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { toast.success("تمت إضافة المستخدم"); setDialogOpen(false); load(); }
    else { const d = await res.json(); toast.error(d.error ?? "حدث خطأ"); }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    if (res.ok) { toast.success("تم حذف المستخدم"); load(); }
    else toast.error("حدث خطأ");
  }

  function openEdit(u: User) {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, roleId: u.userRoles[0]?.role.id ?? "" });
  }

  async function handleEdit() {
    if (!editUser) return;
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) { toast.success("تم تحديث بيانات المستخدم"); setEditUser(null); load(); }
    else toast.error("حدث خطأ أثناء التحديث");
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    if (res.ok) {
      toast.success(u.isActive ? "تم إلغاء تنشيط المستخدم" : "تم تنشيط المستخدم");
      load();
    } else toast.error("حدث خطأ");
  }

  async function toggleForce2FA(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twoFactorForced: !u.twoFactorForced }),
    });
    if (res.ok) {
      toast.success(u.twoFactorForced ? "تم إلغاء إجبار المصادقة الثنائية" : "تم تفعيل إجبار المصادقة الثنائية");
      load();
    } else toast.error("حدث خطأ");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users size={22} className="text-primary" /> إدارة المستخدمين
        </h1>
        <button
          onClick={() => { setForm({ email: "", name: "", password: "", roleId: "" }); setDialogOpen(true); }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> إضافة مستخدم
        </button>
      </div>

      {loading ? <SkeletonTable rows={5} /> : error ? <ErrorState onRetry={load} /> : (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-right px-4 py-3 font-semibold">المستخدم</th>
                <th className="text-right px-4 py-3 font-semibold">الدور</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="text-right px-4 py-3 font-semibold">المصادقة الثنائية</th>
                <th className="text-right px-4 py-3 font-semibold">تاريخ الإنشاء</th>
                <th className="text-right px-4 py-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={`${i % 2 === 0 ? "" : "bg-muted/20"} ${!u.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                      {u.userRoles[0]?.role.name ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <UserCheck size={12} /> نشط
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
                        <UserX size={12} /> غير نشط
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {u.twoFactorEnabled ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs">
                          <Shield size={12} /> مفعّل
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          <ShieldOff size={12} /> غير مفعّل
                        </span>
                      )}
                      {u.twoFactorForced && (
                        <span className="flex items-center gap-1 text-amber-600 text-xs">
                          <ShieldAlert size={12} /> مُجبَر
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("ar-SA")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* تعديل البيانات */}
                      <button
                        onClick={() => openEdit(u)}
                        title="تعديل بيانات المستخدم"
                        className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded text-blue-500"
                      >
                        <Pencil size={14} />
                      </button>
                      {/* إلغاء / تنشيط */}
                      <button
                        onClick={() => toggleActive(u)}
                        title={u.isActive ? "إلغاء تنشيط المستخدم" : "تنشيط المستخدم"}
                        className={`p-1.5 rounded ${u.isActive ? "hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-500" : "hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600"}`}
                      >
                        {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      {/* إجبار 2FA */}
                      <button
                        onClick={() => toggleForce2FA(u)}
                        title={u.twoFactorForced ? "إلغاء إجبار المصادقة الثنائية" : "إجبار المصادقة الثنائية"}
                        className={`p-1.5 rounded ${u.twoFactorForced ? "hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600" : "hover:bg-muted text-muted-foreground"}`}
                      >
                        <ShieldAlert size={14} />
                      </button>
                      {/* حذف */}
                      <button
                        onClick={() => setDeleteTarget(u.id)}
                        title="حذف المستخدم"
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا يوجد مستخدمون</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* نافذة إضافة مستخدم */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-bold mb-4">إضافة مستخدم جديد</h2>
            <div className="space-y-3">
              {[
                { key: "name", label: "الاسم *", type: "text", ph: "اسم المستخدم" },
                { key: "email", label: "البريد الإلكتروني *", type: "email", ph: "user@example.com" },
                { key: "password", label: "كلمة المرور *", type: "password", ph: "8 أحرف على الأقل" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.ph}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">الدور *</label>
                <select
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">اختر الدور...</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">إلغاء</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 font-medium disabled:opacity-60 disabled:pointer-events-none">{saving ? "جارٍ الإضافة..." : "إضافة"}</button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تأكيد الحذف */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف المستخدم"
        description="هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* نافذة تعديل مستخدم */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-bold mb-4">تعديل بيانات المستخدم</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">الاسم</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">الدور</label>
                <select
                  value={editForm.roleId}
                  onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">اختر الدور...</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">إلغاء</button>
              <button onClick={handleEdit} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 font-medium">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
