"use client";

import { useEffect, useState } from "react";
import { X, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface JournalEntry {
  id: string;
  date: string;
  entryNumber: string;
  description?: string;
  debit: number;
  credit: number;
  reference?: string;
  currency: string;
}

interface Props {
  accountKey: string;
  accountNameAr: string;
  companyName: string;
  periods: string[];
  onClose: () => void;
}

export function JournalEntryModal({ accountKey, accountNameAr, companyName, periods, onClose }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const base = new URLSearchParams({ companyName, accountKey });
    const periodsQuery = periods.map((p) => `periods[]=${encodeURIComponent(p)}`).join("&");
    fetch(`/api/journal-entries?${base}&${periodsQuery}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setEntries(d.entries ?? []); setLoading(false); })
      .catch(() => { setFetchError(true); setLoading(false); });
  }, [accountKey, companyName, periods]);

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h2 className="font-bold">{accountNameAr}</h2>
            <span className="text-muted-foreground text-sm">· {companyName} · {periods.join("، ")}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : fetchError ? (
            <div className="p-8 text-center text-destructive text-sm">تعذّر تحميل البيانات، يرجى المحاولة مجدداً</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              لا توجد قيود محاسبية لهذا البند
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-right px-4 py-2.5 font-semibold">التاريخ</th>
                  <th className="text-right px-4 py-2.5 font-semibold">رقم القيد</th>
                  <th className="text-right px-4 py-2.5 font-semibold">الوصف</th>
                  <th className="text-left px-4 py-2.5 font-semibold">مدين</th>
                  <th className="text-left px-4 py-2.5 font-semibold">دائن</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    <td className="px-4 py-2">{new Date(e.date).toLocaleDateString("ar-SA")}</td>
                    <td className="px-4 py-2 font-mono">{e.entryNumber}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{e.description ?? "—"}</td>
                    <td className="px-4 py-2 text-left font-mono text-blue-600">
                      {e.debit > 0 ? formatCurrency(e.debit, e.currency as "SAR") : "—"}
                    </td>
                    <td className="px-4 py-2 text-left font-mono text-red-500">
                      {e.credit > 0 ? formatCurrency(e.credit, e.currency as "SAR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={3} className="px-4 py-2 font-semibold text-right">الإجمالي</td>
                  <td className="px-4 py-2 font-mono font-bold text-left text-blue-600">
                    {formatCurrency(totalDebit, "SAR")}
                  </td>
                  <td className="px-4 py-2 font-mono font-bold text-left text-red-500">
                    {formatCurrency(totalCredit, "SAR")}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
