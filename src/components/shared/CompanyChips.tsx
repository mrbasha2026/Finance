"use client";

import { cn } from "@/lib/utils";

interface CompanyChip {
  name: string;
  color: string;
}

interface CompanyChipsProps {
  companies: CompanyChip[];
  selected: string[];
  onToggle: (name: string) => void;
  className?: string;
}

export function CompanyChips({ companies, selected, onToggle, className }: CompanyChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {companies.map((c) => {
        const active = selected.includes(c.name);
        return (
          <button
            key={c.name}
            onClick={() => onToggle(c.name)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
              active
                ? "text-white shadow-sm"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
            style={active ? { backgroundColor: c.color, borderColor: c.color } : {}}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: c.color }}
            />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
