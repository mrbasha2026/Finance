import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch leaf categories for the chart-of-accounts reference sheet
  const allCats = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { children: { select: { id: true } } },
  });
  const leaves = allCats.filter((c) => c.children.length === 0 && c.pnlKey && !c.isCalculated);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Journal entries template ─────────────────────────────────────
  const headers = [
    "اسم الشركة",
    "التاريخ",
    "رقم القيد",
    "كود الحساب",
    "اسم الحساب",
    "الوصف",
    "مدين",
    "دائن",
    "المرجع",
    "العملة",
  ];

  const dateStr = new Date().toISOString().split("T")[0];

  const exampleRows = [
    ["شركة أ", dateStr, "Q001", "4001", "إيرادات المبيعات", "مبيعات الشهر", 0, 100000, "INV-001", "SAR"],
    ["شركة أ", dateStr, "Q002", "5001", "تكلفة المبيعات",   "تكلفة البضاعة", 60000, 0, "COST-001", "SAR"],
    ["شركة أ", dateStr, "Q003", "6001", "مصاريف الرواتب",   "رواتب الموظفين", 20000, 0, "PAY-001", "SAR"],
  ];

  const wsEntries = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);

  wsEntries["!cols"] = [
    { wch: 20 }, // اسم الشركة
    { wch: 14 }, // التاريخ
    { wch: 12 }, // رقم القيد
    { wch: 14 }, // كود الحساب
    { wch: 28 }, // اسم الحساب
    { wch: 28 }, // الوصف
    { wch: 14 }, // مدين
    { wch: 14 }, // دائن
    { wch: 14 }, // المرجع
    { wch: 10 }, // العملة
  ];

  XLSX.utils.book_append_sheet(wb, wsEntries, "القيود");

  // ── Sheet 2: Chart of accounts reference ──────────────────────────────────
  const coaHeaders = ["كود الحساب (pnlKey)", "اسم الحساب", "النوع"];
  const coaRows = leaves.map((c) => [
    c.pnlKey,
    c.nameAr,
    c.type === "revenue" ? "إيراد" : c.type === "expense" ? "مصروف" : c.type,
  ]);

  const wsCoa = XLSX.utils.aoa_to_sheet([coaHeaders, ...coaRows]);
  wsCoa["!cols"] = [{ wch: 28 }, { wch: 35 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsCoa, "دليل الحسابات");

  // ── Sheet 3: Instructions ─────────────────────────────────────────────────
  const instructions = [
    ["تعليمات استخدام قالب القيود"],
    [""],
    ["1. أدخل قيودك المحاسبية في ورقة «القيود» — كل سطر يمثّل قيداً واحداً"],
    ["2. عمود «التاريخ»: أدخل تاريخ القيد — الفترة تُحسب تلقائياً من الشهر والسنة"],
    ["3. عمود «كود الحساب»: استخدم الأكواد الموجودة في ورقة «دليل الحسابات» للربط التلقائي"],
    ["4. عمود «مدين»: أدخل المبلغ عند الترحيل للمدين، وصفراً عند عدمه"],
    ["5. عمود «دائن»: أدخل المبلغ عند الترحيل للدائن، وصفراً عند عدمه"],
    ["6. يمكنك إضافة صفوف بلا حدود — النظام يجمّع تلقائياً حسب الحساب والفترة"],
    ["7. بعد الرفع ستظهر الحسابات غير المعرّفة لربطها يدوياً"],
    [""],
    ["ملاحظة: النظام يحسب الإيرادات = دائن − مدين، والمصاريف = مدين − دائن"],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr["!cols"] = [{ wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "تعليمات");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="PnL_JournalEntries_Template.xlsx"',
    },
  });
}
