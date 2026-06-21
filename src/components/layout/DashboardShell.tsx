"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface DashboardShellProps {
  permissions: string[];
  user: { name: string; email: string };
  children: React.ReactNode;
}

export function DashboardShell({ permissions, user, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        permissions={permissions}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          user={user}
          onMenuOpen={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
