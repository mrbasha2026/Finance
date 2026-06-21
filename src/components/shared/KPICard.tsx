"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number | null;
  icon?: LucideIcon;
  colorVariant?: "blue" | "emerald" | "teal" | "cyan" | "amber" | "violet";
  className?: string;
}

const variantStyles = {
  blue:    "bg-blue-50   border-blue-200   dark:bg-blue-950/30   dark:border-blue-800",
  emerald: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
  teal:    "bg-teal-50   border-teal-200   dark:bg-teal-950/30   dark:border-teal-800",
  cyan:    "bg-cyan-50   border-cyan-200   dark:bg-cyan-950/30   dark:border-cyan-800",
  amber:   "bg-amber-50  border-amber-200  dark:bg-amber-950/30  dark:border-amber-800",
  violet:  "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
};

const titleColors = {
  blue:    "text-blue-600   dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  teal:    "text-teal-600   dark:text-teal-400",
  cyan:    "text-cyan-600   dark:text-cyan-400",
  amber:   "text-amber-600  dark:text-amber-400",
  violet:  "text-violet-600 dark:text-violet-400",
};

const iconBgColors = {
  blue:    "bg-blue-100   dark:bg-blue-900/50",
  emerald: "bg-emerald-100 dark:bg-emerald-900/50",
  teal:    "bg-teal-100   dark:bg-teal-900/50",
  cyan:    "bg-cyan-100   dark:bg-cyan-900/50",
  amber:   "bg-amber-100  dark:bg-amber-900/50",
  violet:  "bg-violet-100 dark:bg-violet-900/50",
};

const iconTextColors = {
  blue:    "text-blue-600   dark:text-blue-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  teal:    "text-teal-600   dark:text-teal-400",
  cyan:    "text-cyan-600   dark:text-cyan-400",
  amber:   "text-amber-600  dark:text-amber-400",
  violet:  "text-violet-600 dark:text-violet-400",
};

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  colorVariant = "teal",
  className,
}: KPICardProps) {
  const trendPositive = trend !== null && trend !== undefined && trend >= 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 flex flex-col gap-2 card-hover",
        variantStyles[colorVariant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-xs font-semibold uppercase tracking-wide leading-snug", titleColors[colorVariant])}>
          {title}
        </p>
        {Icon && (
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", iconBgColors[colorVariant])}>
            <Icon size={14} className={iconTextColors[colorVariant]} />
          </div>
        )}
      </div>

      <p className="text-2xl font-bold text-foreground leading-tight tracking-tight">
        {value}
      </p>

      {(subtitle !== undefined || trend !== undefined) && (
        <div className="flex items-center gap-2">
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
          {trend !== null && trend !== undefined && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                trendPositive
                  ? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/40"
                  : "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/40"
              )}
            >
              {trendPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
