"use client";

import { useEffect, useState } from "react";
import { ClipboardList, ChevronDown, ChevronLeft, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { SkeletonTable } from "@/components/shared/SkeletonLoaders";

interface Log {
  id: string;
  userEmail: string | null;
  action: string;
  module: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const MODULE_LABELS: Record<string, string> = {
  pnl: "P&L", companies: "الشركات", users: "المستخدمون",
  roles: "الأدوار", audit: "التدقيق",
};
const ACTION_LABELS: Record<string, string> = {
  upload: "رفع", delete: "حذف", login: "دخول", update: "تحديث", create: "إنشاء",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState({ userEmail: "", module: "", from: "", to: "" });

  async function load(p = page) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "25" });
    if (filters.userEmail) params.set("userEmail", filters.userEmail);
    if (filters.module) params.set("module", filters.module);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    const res = await fetch(`/api/audit?${params}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page]);

  function handleExport() {
    const rows = logs.map((l) => ({
      التاريخ: new Date(l.createdAt).toLocaleString("ar-SA"),
      المستخدم: l.userEmail ?? "نظام",
      الإجراء: ACTION_LABELS[l.action] ?? l.action,
      الوحدة: MODULE_LABELS[l.module] ?? l.module,
      "عنوان IP": l.ipAddress ?? "—",
      التفاصيل: JSON.stringify(l.details ?? {}),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل التدقيق");
    XLSX.writeFile(wb, "audit-log.xlsx");
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList size={22} className="text-primary" /> سجل التدقيق
        </h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm hover:bg-muted font-medium"
        >
          <Download size={14} /> تصدير Excel
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-card rounded-xl border">
        <input
          placeholder="فلتر بالبريد الإلكتروني"
          value={filters.userEmail}
          onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <select
          value={filters.module}
          onChange={(e) => setFilters({ ...filters, module: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">كل الوحدات</option>
          {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
        <button onClick={() => { setPage(1); load(1); }}
          className="col-span-full sm:col-span-1 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">
          بحث
        </button>
      </div>

      {loading ? <SkeletonTable rows={10} /> : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b sticky top-0">
                <tr>
                  <th className="text-right px-4 py-3 font-semibold">التاريخ</th>
                  <th className="text-right px-4 py-3 font-semibold">المستخدم</th>
                  <th className="text-right px-4 py-3 font-semibold">الإجراء</th>
                  <th className="text-right px-4 py-3 font-semibold">الوحدة</th>
                  <th className="text-right px-4 py-3 font-semibold">IP</th>
                  <th className="text-right px-4 py-3 font-semibold">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <>
                    <tr key={log.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("ar-SA")}
                      </td>
                      <td className="px-4 py-2.5">{log.userEmail ?? "نظام"}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{MODULE_LABELS[log.module] ?? log.module}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ipAddress ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {log.details && Object.keys(log.details).length > 0 && (
                          <button
                            onClick={() => setExpanded((p) => ({ ...p, [log.id]: !p[log.id] }))}
                            className="text-primary text-xs flex items-center gap-1"
                          >
                            {expanded[log.id] ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
                            عرض
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded[log.id] && log.details && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={6} className="px-4 py-2 bg-muted/30">
                          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا توجد سجلات</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-muted">
                السابق
              </button>
              <span className="text-muted-foreground">صفحة {page} من {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-muted">
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
