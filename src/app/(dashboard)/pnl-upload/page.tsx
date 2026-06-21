"use client";

import { ExcelUpload } from "@/app/(dashboard)/pnl-entry/ExcelUpload";
import { Upload } from "lucide-react";

export default function PnLUploadPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload size={22} className="text-primary" /> رفع بيانات Excel
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          ارفع ملفات Excel لبيانات الأرباح والخسائر
        </p>
      </div>

      <ExcelUpload />
    </div>
  );
}
