"use client";

import { useState } from "react";
import { PnLManualForm } from "./PnLManualForm";
import { ExcelUpload } from "./ExcelUpload";
import { PenLine, Upload, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import PeriodsContent from "./PeriodsContent";

type Tab = "periods" | "excel" | "manual";

export default function PnLEntryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("periods");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PenLine size={22} className="text-primary" /> إدخال بيانات P&L
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          إدارة الفترات، رفع ملف Excel، أو الإدخال اليدوي
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {([
          { key: "periods" as Tab, label: "إدارة الفترات", icon: CalendarDays },
          { key: "excel"   as Tab, label: "رفع ملف",       icon: Upload },
          { key: "manual"  as Tab, label: "إدخال يدوي",    icon: PenLine },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="fade-in">
        {activeTab === "periods" && <PeriodsContent />}
        {activeTab === "excel"   && <ExcelUpload />}
        {activeTab === "manual"  && <PnLManualForm />}
      </div>
    </div>
  );
}
