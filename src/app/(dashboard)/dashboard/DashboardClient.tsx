"use client";

import { KPICard } from "@/components/shared/KPICard";
import { formatCurrency } from "@/lib/format";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Building2, Database, TrendingUp, Activity,
  DollarSign, Briefcase,
} from "lucide-react";

interface DashboardDataset {
  companyName: string;
  companyColor: string;
  period: string;
  netIncome: number;
  revenue: number;
  currency: string;
}

interface AuditEntry {
  id: string;
  userEmail: string | null;
  action: string;
  module: string;
  createdAt: string;
}

interface Props {
  userName: string;
  companiesCount: number;
  datasetsCount: number;
  recentLogs: AuditEntry[];
  datasets: DashboardDataset[];
}

const MODULE_LABELS: Record<string, string> = {
  pnl: "بيانات P&L",
  companies: "الشركات",
  users: "المستخدمون",
  roles: "الأدوار",
  audit: "التدقيق",
};

const ACTION_LABELS: Record<string, string> = {
  upload: "رفع",
  delete: "حذف",
  login: "دخول",
  update: "تحديث",
  create: "إنشاء",
};

const ACTION_COLORS: Record<string, string> = {
  upload:  "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  delete:  "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  login:   "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  update:  "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  create:  "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
};

export function DashboardClient({
  userName,
  companiesCount,
  datasetsCount,
  recentLogs,
  datasets,
}: Props) {
  const latest = datasets[0];
  const latestRevenue = latest?.revenue ?? 0;
  const latestNetIncome = latest?.netIncome ?? 0;

  const primaryCurrency = datasets[0]?.currency ?? "SAR";
  const periodMap: Record<string, number> = {};
  for (const d of datasets) {
    if (d.currency !== primaryCurrency) continue;
    periodMap[d.period] = (periodMap[d.period] ?? 0) + d.revenue;
  }
  const trendData = Object.entries(periodMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([period, revenue]) => ({ period: period.slice(0, 7), revenue }));

  const companyMap: Record<string, { netIncome: number; color: string }> = {};
  for (const d of datasets) {
    if (!companyMap[d.companyName]) {
      companyMap[d.companyName] = { netIncome: 0, color: d.companyColor };
    }
    companyMap[d.companyName].netIncome += d.netIncome;
  }
  const topCompanies = Object.entries(companyMap)
    .sort(([, a], [, b]) => b.netIncome - a.netIncome)
    .slice(0, 8)
    .map(([name, { netIncome, color }]) => ({ name, netIncome, color }));

  return (
    <div className="space-y-5">

      {/* ── Welcome banner ── */}
      <div className="welcome-banner">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white leading-tight">
              مرحباً، {userName}
            </h1>
            <p className="text-white/65 text-sm mt-0.5">
              نظرة عامة على أداء محفظة شركاتك
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-white/40">
            <TrendingUp size={32} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          title="إجمالي الشركات"
          value={String(companiesCount)}
          icon={Building2}
          colorVariant="blue"
        />
        <KPICard
          title="مجموعات البيانات"
          value={String(datasetsCount)}
          icon={Database}
          colorVariant="violet"
        />
        <KPICard
          title="أحدث إيراد"
          value={formatCurrency(latestRevenue, "SAR", true)}
          icon={DollarSign}
          colorVariant="cyan"
        />
        <KPICard
          title="أحدث صافي ربح"
          value={formatCurrency(latestNetIncome, "SAR", true)}
          icon={Briefcase}
          colorVariant={latestNetIncome >= 0 ? "emerald" : "amber"}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue Trend */}
        <div className="rounded-2xl border bg-card p-5 card-hover">
          <div className="section-header">
            <span className="section-header-icon">
              <TrendingUp size={14} />
            </span>
            اتجاه الإيرادات
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  style={{ stopColor: "var(--brand-green)", stopOpacity: 0.28 }} />
                  <stop offset="95%" style={{ stopColor: "var(--brand-green)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v, "SAR", true), "الإيرادات"]}
                contentStyle={{ borderRadius: "0.75rem", fontSize: "0.8125rem" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--brand-green)"
                fill="url(#revGrad)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Companies */}
        <div className="rounded-2xl border bg-card p-5 card-hover">
          <div className="section-header">
            <span className="section-header-icon">
              <Building2 size={14} />
            </span>
            أعلى الشركات ربحاً
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={topCompanies} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v, "SAR", true), "صافي الربح"]}
                contentStyle={{ borderRadius: "0.75rem", fontSize: "0.8125rem" }}
              />
              <Bar dataKey="netIncome" radius={[0, 5, 5, 0]}>
                {topCompanies.map((c) => (
                  <Cell key={c.name} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="rounded-2xl border bg-card p-5 card-hover">
        <div className="section-header">
          <span className="section-header-icon">
            <Activity size={14} />
          </span>
          النشاط الأخير
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">لا يوجد نشاط بعد</p>
        ) : (
          <div className="divide-y divide-border">
            {recentLogs.map((log) => {
              const actionColor = ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground";
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${actionColor}`}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <div className="flex-1 min-w-0 text-muted-foreground">
                    <span className="font-medium text-foreground">{log.userEmail ?? "نظام"}</span>
                    <span className="mx-1">·</span>
                    <span>{MODULE_LABELS[log.module] ?? log.module}</span>
                  </div>
                  <time className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleDateString("ar-SA")}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
