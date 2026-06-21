import { Currency } from "./pnl-types";

export function formatNumber(
  value: number,
  opts: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals = 0 } = opts;

  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000)
      return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)
      return `${(value / 1_000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrency(
  value: number,
  currency: Currency = "SAR",
  compact = false
): string {
  const formatted = formatNumber(value, { compact, decimals: compact ? 1 : 0 });
  return `${formatted} ${currency}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
