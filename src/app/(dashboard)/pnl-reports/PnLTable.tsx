"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { calcPercentChange } from "@/lib/pnl-calculations";
import { formatCurrency } from "@/lib/format";
import { ChangeIndicator } from "@/components/shared/NumberDisplay";
import { DynamicCategory, catKey, FORMULA_KEYS } from "@/lib/category-types";
import { cn } from "@/lib/utils";
import { JournalEntryModal } from "./JournalEntryModal";

export const ROW_STYLES: Record<string, string> = {
  revenue:                    "bg-revenue-row font-bold text-blue-700 dark:text-blue-400",
  gross_profit:               "bg-gross-profit-row font-bold text-emerald-700 dark:text-emerald-400",
  cost_of_sales:              "bg-opex-row font-semibold text-orange-700 dark:text-orange-400",
  selling_distribution_expenses: "font-semibold text-orange-600 dark:text-orange-300",
  general_admin_expenses:     "font-semibold text-orange-600 dark:text-orange-300",
  research_development:       "font-semibold text-orange-600 dark:text-orange-300",
  depreciation_amortization:  "font-semibold text-orange-600 dark:text-orange-300",
  operating_income:           "bg-operating-income-row font-bold text-emerald-700 dark:text-emerald-400",
  finance_income:             "font-semibold text-teal-600 dark:text-teal-300",
  finance_costs:              "font-semibold text-red-600 dark:text-red-300",
  income_before_zakat:        "bg-emerald-50 dark:bg-emerald-950/20 font-semibold",
  zakat_expense:              "bg-zakat-row text-violet-700 dark:text-violet-400",
  net_income:                 "bg-net-income-row font-bold text-emerald-800 dark:text-emerald-300 border-t-2 border-emerald-400",
  other_comprehensive_income: "bg-blue-50 dark:bg-blue-950/20 font-semibold text-blue-700 dark:text-blue-300",
  total_comprehensive_income: "bg-blue-100 dark:bg-blue-900/30 font-bold text-blue-800 dark:text-blue-200 border-t-2 border-blue-400",
};

interface PnLTableProps {
  data: Record<string, number>;
  prevData: Record<string, number> | null;
  prevLabel?: string | null;
  prevData2?: Record<string, number> | null;
  prevLabel2?: string | null;
  currency: string;
  companyName: string;
  period: string;
  periodMonths: string[];
  categories: DynamicCategory[];
  onAccountClick?: (key: string, nameAr: string, periods: string[]) => void;
}

// Build tree from flat list
export function buildTree(flat: DynamicCategory[]): DynamicCategory[] {
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

export function PnLTable({ data, prevData, prevLabel, prevData2, prevLabel2, currency, companyName, period, periodMonths, categories, onAccountClick }: PnLTableProps) {
  const roots = buildTree(categories);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Default: expand top-level and group-level nodes
    const init: Record<string, boolean> = {};
    categories.forEach((c) => {
      if (c.children.length > 0 || FORMULA_KEYS.has(c.pnlKey ?? "")) {
        init[c.id] = c.isTotal; // expand totals by default
      }
    });
    return init;
  });
  const [journalModal, setJournalModal] = useState<{ key: string; nameAr: string; periods: string[] } | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const curr = currency as "SAR";

  // Render a node and its children recursively
  function renderNode(cat: DynamicCategory, depth = 0): React.ReactNode {
    const key = catKey(cat);
    const value = data[key] ?? 0;
    const prevValue = prevData ? (prevData[key] ?? 0) : null;
    const prevValue2 = prevData2 ? (prevData2[key] ?? 0) : null;
    const change = prevValue !== null ? calcPercentChange(value, prevValue) : null;
    const change2 = prevValue2 !== null ? calcPercentChange(value, prevValue2) : null;
    const hasChildren = cat.children.length > 0;
    const isExpanded = expanded[cat.id] ?? false;
    const rowStyle = ROW_STYLES[cat.pnlKey ?? ""] ?? "";
    const isFormula = FORMULA_KEYS.has(cat.pnlKey ?? "");

    return [
      <tr
        key={cat.id}
        className={cn(
          "border-b last:border-0 transition-colors",
          rowStyle || (depth === 0 ? "" : "hover:bg-muted/30")
        )}
      >
        <td
          className="px-4 py-2.5 cursor-pointer"
          style={{ paddingRight: `${(depth + 1) * 16}px` }}
          tabIndex={0}
          role="button"
          onClick={() => {
            if (hasChildren) toggle(cat.id);
            else if (!isFormula) {
              if (onAccountClick) onAccountClick(key, cat.nameAr, periodMonths);
              else setJournalModal({ key, nameAr: cat.nameAr, periods: periodMonths });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (hasChildren) toggle(cat.id);
              else if (!isFormula) {
                if (onAccountClick) onAccountClick(key, cat.nameAr, periodMonths);
                else setJournalModal({ key, nameAr: cat.nameAr, periods: periodMonths });
              }
            }
          }}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              <span className="text-muted-foreground">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
              </span>
            )}
            <span className={cn(depth === 0 || cat.isTotal || cat.isSubtotal ? "font-semibold" : "")}>
              {cat.nameAr}
            </span>
          </div>
        </td>
        <td className={cn(
          "px-4 py-2.5 text-left font-mono",
          value < 0 ? "text-negative" : cat.type === "profit" ? (value >= 0 ? "text-positive" : "text-negative") : ""
        )}>
          {formatCurrency(value, curr, false)}
        </td>
        {prevData && (
          <>
            <td className="px-4 py-2.5 text-left font-mono text-muted-foreground text-xs">
              {formatCurrency(prevValue ?? 0, curr, false)}
            </td>
            <td className="px-4 py-2.5 text-left">
              <ChangeIndicator change={change} />
            </td>
          </>
        )}
        {prevData2 && (
          <>
            <td className="px-4 py-2.5 text-left font-mono text-muted-foreground text-xs">
              {formatCurrency(prevValue2 ?? 0, curr, false)}
            </td>
            <td className="px-4 py-2.5 text-left">
              <ChangeIndicator change={change2} />
            </td>
          </>
        )}
      </tr>,
      ...(hasChildren && isExpanded
        ? cat.children.map((child) => renderNode(child, depth + 1))
        : []),
    ];
  }

  return (
    <>
      <div className="rounded-xl border overflow-hidden table-sticky-header print-full">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-right px-4 py-3 font-semibold w-[40%]">البند</th>
              <th className="text-left px-4 py-3 font-semibold w-[20%]">{companyName}</th>
              {prevData && (
                <>
                  <th className="text-left px-4 py-3 font-semibold w-[15%]">{prevLabel ?? "الفترة السابقة"}</th>
                  <th className="text-left px-4 py-3 font-semibold w-[10%]">التغيير</th>
                </>
              )}
              {prevData2 && (
                <>
                  <th className="text-left px-4 py-3 font-semibold w-[15%]">{prevLabel2 ?? "نفس الفترة السابقة"}</th>
                  <th className="text-left px-4 py-3 font-semibold w-[10%]">التغيير</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {roots.map((root) => renderNode(root))}
          </tbody>
        </table>
      </div>

      {!onAccountClick && journalModal && (
        <JournalEntryModal
          accountKey={journalModal.key}
          accountNameAr={journalModal.nameAr}
          companyName={companyName}
          periods={journalModal.periods}
          onClose={() => setJournalModal(null)}
        />
      )}
    </>
  );
}
