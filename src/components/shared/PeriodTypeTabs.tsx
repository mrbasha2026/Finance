"use client";

import { PeriodType } from "@/lib/pnl-types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "semi-annual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
];

interface PeriodTypeTabsProps {
  value: PeriodType;
  onChange: (type: PeriodType) => void;
  className?: string;
}

export function PeriodTypeTabs({ value, onChange, className }: PeriodTypeTabsProps) {
  return (
    <div className={cn("flex bg-muted rounded-lg p-0.5 gap-0.5", className)}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
