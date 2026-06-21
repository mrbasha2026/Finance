import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Currency } from "@/lib/pnl-types";

interface NumberDisplayProps {
  value: number;
  currency?: Currency;
  isPercent?: boolean;
  compact?: boolean;
  className?: string;
  colorize?: boolean;
}

export function NumberDisplay({
  value,
  currency = "SAR",
  isPercent = false,
  compact = false,
  className,
  colorize = true,
}: NumberDisplayProps) {
  const isPositive = value >= 0;
  const formatted = isPercent
    ? formatPercent(value)
    : formatCurrency(value, currency, compact);

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        colorize && !isPercent && (isPositive ? "text-positive" : "text-negative"),
        className
      )}
    >
      {formatted}
    </span>
  );
}

interface ChangeIndicatorProps {
  change: number | null;
  className?: string;
}

export function ChangeIndicator({ change, className }: ChangeIndicatorProps) {
  if (change === null) return <span className="text-muted-foreground text-xs">—</span>;

  const positive = change >= 0;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        positive ? "text-emerald-600" : "text-red-500",
        className
      )}
    >
      {positive ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
    </span>
  );
}
