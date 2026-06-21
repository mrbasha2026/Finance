"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

const TERMS: Record<string, string> = {
  EBITDA: "الأرباح قبل الفوائد والضرائب والاستهلاك والإطفاء — مقياس الربحية التشغيلية الأساسية",
  EBIT: "الأرباح قبل الفوائد والضرائب — يُظهر الربح من العمليات الأساسية قبل تأثير التمويل",
  "R²": "معامل التحديد — يقيس مدى دقة نموذج التوقع (1.0 = مثالي، 0 = لا علاقة)",
  "Gross Profit": "إجمالي الربح — الفرق بين الإيرادات وتكلفة المبيعات",
  EBITDA_AR: "الأرباح قبل الفوائد والضرائب والاستهلاك والإطفاء",
};

interface FinancialTooltipProps {
  term: keyof typeof TERMS;
  children?: React.ReactNode;
}

export function FinancialTooltip({ term, children }: FinancialTooltipProps) {
  const [open, setOpen] = useState(false);
  const definition = TERMS[term];
  if (!definition) return <>{children}</>;

  return (
    <span className="relative inline-flex items-center gap-1">
      {children ?? <span className="font-medium">{term}</span>}
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`شرح ${term}`}
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span className="absolute bottom-full mb-1.5 right-0 z-50 w-64 bg-popover border rounded-xl p-3 shadow-xl text-xs text-popover-foreground leading-relaxed whitespace-normal">
          <span className="font-semibold block mb-0.5">{term}</span>
          {definition}
        </span>
      )}
    </span>
  );
}
