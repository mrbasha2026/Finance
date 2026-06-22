"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Building2, Tags, FileBarChart2,
  PenLine, FileText, Receipt, Sparkles, TrendingUp,
  Users, ShieldCheck, ClipboardList, Settings,
  ChevronRight, ChevronLeft, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  permission?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const navGroups: NavGroup[] = [
  {
    title: "الرئيسية",
    items: [
      { href: "/dashboard",  icon: LayoutDashboard, label: "لوحة التحكم" },
      { href: "/companies",  icon: Building2,       label: "إدارة الشركات",      permission: "companies.view" },
      { href: "/categories", icon: Tags,            label: "التصنيفات والأقسام", permission: "expenses.categories" },
    ],
  },
  {
    title: "الإدارة المالية",
    items: [
      { href: "/pnl-reports",    icon: FileBarChart2, label: "تقارير شركة",        permission: "pnl.view" },
      { href: "/pnl-entry",      icon: PenLine,       label: "إدخال البيانات",     permission: "pnl.upload" },
      { href: "/shared-reports", icon: FileText,      label: "تقارير مشتركة",      permission: "pnl.shared_view" },
      { href: "/prepaid",        icon: Receipt,       label: "المصروفات المقدمة",  permission: "prepaid.view" },
      { href: "/ai-analysis",    icon: Sparkles,      label: "تحليل ذكي",           permission: "forecasts.view" },
      { href: "/forecasts",      icon: TrendingUp,    label: "التوقعات المالية",   permission: "forecasts.view" },
    ],
  },
  {
    title: "الإدارة",
    adminOnly: true,
    items: [
      { href: "/users",    icon: Users,         label: "المستخدمون",         permission: "users.view" },
      { href: "/roles",    icon: ShieldCheck,   label: "الأدوار والصلاحيات", permission: "roles.view" },
      { href: "/audit",    icon: ClipboardList, label: "سجل التدقيق",        permission: "system.audit" },
      { href: "/settings", icon: Settings,      label: "إعدادات النظام",     permission: "system.settings" },
    ],
  },
];

interface SidebarProps {
  permissions: string[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ permissions, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasPermission = (perm?: string) => !perm || permissions.includes(perm);

  const navContent = (
    <>
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-3 h-16 shrink-0"
           style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }}>
        <div className="flex items-center gap-2 min-w-0">
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/icons/icon-192.png"
              alt="DealzTree"
              style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo-dealztree-app.png"
              alt="DealzTree"
              style={{ width: 140, height: 50, objectFit: "contain" }}
            />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* زر إغلاق الموبايل */}
          {mobileOpen && onMobileClose && (
            <button
              onClick={onMobileClose}
              aria-label="إغلاق القائمة"
              className="lg:hidden p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-muted transition-colors"
            >
              <X size={16} />
            </button>
          )}
          {/* زر طي/توسيع - للشاشات الكبيرة فقط */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
            aria-expanded={!collapsed}
            className="hidden lg:flex p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-muted shrink-0 transition-colors"
          >
            {/* في RTL: عند التوسع نعرض ChevronLeft، عند الطي نعرض ChevronRight */}
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navGroups.map((group, gi) => {
          const visibleItems = group.items.filter((item) => hasPermission(item.permission));

          if (
            group.adminOnly &&
            !permissions.some((p) =>
              ["users.view", "roles.view", "system.audit", "system.settings"].includes(p)
            )
          ) return null;

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className={cn("pb-2", gi > 0 && "pt-2")}>
              {!collapsed ? (
                <div className="flex items-center gap-2 px-2 mb-1.5">
                  {gi > 0 && (
                    <div className="flex-1 h-px" style={{ backgroundColor: "hsl(var(--sidebar-border))" }} />
                  )}
                  <p className="text-[10px] font-bold text-sidebar-muted uppercase tracking-widest whitespace-nowrap">
                    {group.title}
                  </p>
                  <div className="flex-1 h-px" style={{ backgroundColor: "hsl(var(--sidebar-border))" }} />
                </div>
              ) : (
                gi > 0 && (
                  <div className="mx-3 my-1 h-px" style={{ backgroundColor: "hsl(var(--sidebar-border))" }} />
                )
              )}

              {visibleItems.map((item) => {
                const active = mounted && (pathname === item.href || pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    onClick={onMobileClose}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-2",
                      active
                        ? "text-white"
                        : "text-sidebar-fg opacity-65 hover:opacity-100 hover:bg-sidebar-accent"
                    )}
                    style={active ? {
                      backgroundColor: "color-mix(in srgb, var(--brand-green) 22%, transparent)",
                    } : undefined}
                  >
                    {/* مؤشر العنصر النشط — على اليسار في RTL */}
                    {active && !collapsed && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                        style={{ backgroundColor: "var(--brand-green)" }}
                      />
                    )}

                    <span
                      className={cn(
                        "flex items-center justify-center w-7 h-7 rounded-md shrink-0 transition-colors",
                        active ? "bg-white/15" : ""
                      )}
                    >
                      <item.icon
                        size={16}
                        style={active ? { color: "var(--brand-green)" } : undefined}
                      />
                    </span>

                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      {!collapsed && (
        <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid hsl(var(--sidebar-border))" }}>
          <p className="text-[10px] text-sidebar-muted text-center">
            © {new Date().getFullYear()} DealzTree®
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ── Sidebar للشاشات الكبيرة ── */}
      <aside
        className={cn(
          "no-print hidden lg:flex h-screen flex-col sidebar-transition shrink-0 bg-sidebar",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {navContent}
      </aside>

      {/* ── Sidebar للموبايل (drawer) ── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className="lg:hidden fixed inset-y-0 right-0 z-50 w-72 flex flex-col bg-sidebar shadow-2xl">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
