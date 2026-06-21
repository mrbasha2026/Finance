"use client";

import { Sun, Moon, LogOut, User, Settings, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getInitials } from "@/lib/utils";

interface TopBarUser {
  name: string;
  email: string;
}

interface TopBarProps {
  user: TopBarUser;
  onMenuOpen?: () => void;
}

export function TopBar({ user, onMenuOpen }: TopBarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <header className="no-print h-16 shrink-0 border-b bg-card flex items-center justify-between px-4 gap-3"
            style={{ boxShadow: "0 1px 0 hsl(var(--border))" }}>

      {/* ── زر القائمة للموبايل ── */}
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
        title="القائمة الجانبية"
      >
        <Menu size={18} />
      </button>

      {/* ── فراغ مرن (يحل محل البحث المعطل) ── */}
      <div className="flex-1" />

      <div className="flex items-center gap-1">

        {/* ── مبدّل المظهر ── */}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
          title="تبديل الوضع"
        >
          {mounted && (resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />)}
        </button>

        {/* ── فاصل ── */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* ── قائمة المستخدم ── */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-muted transition-colors"
          >
            <span className="hidden sm:block text-sm font-medium leading-none">{user.name}</span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
              style={{ background: "linear-gradient(135deg, var(--brand-green-deep) 0%, var(--brand-green) 100%)" }}
            >
              {getInitials(user.name)}
            </div>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-2 w-52 bg-card border rounded-2xl shadow-xl z-20 overflow-hidden text-sm">

                <div className="px-4 py-3 bg-muted/40 border-b">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--brand-green-deep) 0%, var(--brand-green) 100%)" }}
                    >
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-sm">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
                  >
                    <User size={14} className="shrink-0" />
                    <span>الملف الشخصي</span>
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
                  >
                    <Settings size={14} className="shrink-0" />
                    <span>الإعدادات</span>
                  </Link>
                </div>

                <div className="border-t py-1">
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-destructive/8 text-destructive w-full transition-colors"
                  >
                    <LogOut size={14} className="shrink-0" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
