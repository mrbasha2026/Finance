'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { PnLUpload } from '@/components/pnl/PnLUpload';

export function ExcelUploadModule() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">رفع بيانات Excel</h2>
        <p className="text-sm text-muted-foreground mt-1">رفع ملفات Excel لبيانات الأرباح والخسائر</p>
      </div>

      <div className="border-2 border-primary/20 rounded-2xl bg-card">
        <div className="p-5 pb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Upload className="h-4 w-4" />
            </div>
            رفع بيانات P&L
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            ارفع ملفات Excel لبيانات الأرباح والخسائر. يدعم ملفات .xlsx و .xls.
          </p>
        </div>
        <div className="p-5 pt-0">
          <PnLUpload />
        </div>
      </div>
    </div>
  );
}
