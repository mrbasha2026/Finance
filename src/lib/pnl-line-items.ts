import { PnLLineItemDef } from "./pnl-types";

// Full Saudi / Islamic chart of accounts for P&L
// No income tax — Zakat instead (2.5% of zakat base)
export const PNL_LINE_ITEMS: PnLLineItemDef[] = [
  // ═══ REVENUE ═══
  {
    key: "revenue",
    name: "Revenue",
    nameAr: "الإيرادات",
    category: "revenue",
    isTotal: true,
    indent: 0,
    expandable: true,
  },
  {
    key: "sales_revenue",
    name: "Sales Revenue",
    nameAr: "إيرادات المبيعات",
    category: "revenue",
    indent: 1,
    parentKey: "revenue",
  },
  {
    key: "service_revenue",
    name: "Service Revenue",
    nameAr: "إيرادات الخدمات",
    category: "revenue",
    indent: 1,
    parentKey: "revenue",
  },
  {
    key: "other_revenue",
    name: "Other Revenue",
    nameAr: "إيرادات أخرى",
    category: "revenue",
    indent: 1,
    parentKey: "revenue",
  },

  // ═══ COST OF GOODS SOLD ═══
  {
    key: "cost_of_goods_sold",
    name: "Cost of Goods Sold",
    nameAr: "تكلفة البضاعة المباعة",
    category: "expense",
    isTotal: true,
    indent: 1,
    expandable: true,
  },
  {
    key: "raw_materials",
    name: "Raw Materials",
    nameAr: "المواد الخام",
    category: "expense",
    indent: 2,
    parentKey: "cost_of_goods_sold",
  },
  {
    key: "direct_labor",
    name: "Direct Labor",
    nameAr: "العمالة المباشرة",
    category: "expense",
    indent: 2,
    parentKey: "cost_of_goods_sold",
  },
  {
    key: "manufacturing_overhead",
    name: "Manufacturing Overhead",
    nameAr: "مصروفات التصنيع غير المباشرة",
    category: "expense",
    indent: 2,
    parentKey: "cost_of_goods_sold",
  },
  {
    key: "purchases",
    name: "Purchases",
    nameAr: "المشتريات",
    category: "expense",
    indent: 2,
    parentKey: "cost_of_goods_sold",
  },

  // ═══ GROSS PROFIT (calculated) ═══
  {
    key: "gross_profit",
    name: "Gross Profit",
    nameAr: "إجمالي الربح",
    category: "profit",
    isSubtotal: true,
    indent: 0,
  },

  // ═══ OPERATING EXPENSES ═══
  {
    key: "operating_expenses",
    name: "Operating Expenses",
    nameAr: "المصروفات التشغيلية",
    category: "expense",
    isTotal: true,
    indent: 0,
    expandable: true,
  },

  // Selling Expenses
  {
    key: "selling_expenses",
    name: "Selling & Marketing Expenses",
    nameAr: "مصروفات البيع والتسويق",
    category: "expense",
    isSubtotal: true,
    indent: 1,
    expandable: true,
    parentKey: "operating_expenses",
  },
  {
    key: "sales_commissions",
    name: "Sales Commissions",
    nameAr: "عمولات المبيعات",
    category: "expense",
    indent: 2,
    parentKey: "selling_expenses",
  },
  {
    key: "advertising_promotion",
    name: "Advertising & Promotion",
    nameAr: "الإعلان والترويج",
    category: "expense",
    indent: 2,
    parentKey: "selling_expenses",
  },
  {
    key: "marketing_expenses",
    name: "Marketing Expenses",
    nameAr: "مصروفات التسويق",
    category: "expense",
    indent: 2,
    parentKey: "selling_expenses",
  },
  {
    key: "delivery_shipping",
    name: "Delivery & Shipping",
    nameAr: "التوصيل والشحن",
    category: "expense",
    indent: 2,
    parentKey: "selling_expenses",
  },
  {
    key: "customer_service",
    name: "Customer Service",
    nameAr: "خدمة العملاء",
    category: "expense",
    indent: 2,
    parentKey: "selling_expenses",
  },

  // G&A Expenses
  {
    key: "general_admin_expenses",
    name: "General & Administrative Expenses",
    nameAr: "المصروفات الإدارية والعمومية",
    category: "expense",
    isSubtotal: true,
    indent: 1,
    expandable: true,
    parentKey: "operating_expenses",
  },
  {
    key: "salaries_wages",
    name: "Salaries & Wages",
    nameAr: "الرواتب والأجور",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "employee_benefits",
    name: "Employee Benefits & Allowances",
    nameAr: "بدلات ومزايا الموظفين",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "gosi_subscriptions",
    name: "GOSI Subscriptions",
    nameAr: "اشتراكات GOSI",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "rent",
    name: "Rent",
    nameAr: "الإيجارات",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "utilities",
    name: "Utilities",
    nameAr: "المرافق",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "communications",
    name: "Communications",
    nameAr: "الاتصالات",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "stationery",
    name: "Stationery & Office Supplies",
    nameAr: "القرطاسية",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "professional_fees",
    name: "Professional Fees",
    nameAr: "الأتعاب المهنية",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "travel_hospitality",
    name: "Travel & Hospitality",
    nameAr: "السفر والضيافة",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "insurance",
    name: "Insurance",
    nameAr: "التأمين",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "maintenance",
    name: "Maintenance & Repairs",
    nameAr: "الصيانة",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "licenses",
    name: "Licenses & Permits",
    nameAr: "التراخيص",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "subscriptions_software",
    name: "Subscriptions & Software",
    nameAr: "الاشتراكات والبرمجيات",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "bad_debts",
    name: "Bad Debts",
    nameAr: "الديون المعدومة",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },
  {
    key: "miscellaneous_expenses",
    name: "Miscellaneous Expenses",
    nameAr: "مصروفات متنوعة",
    category: "expense",
    indent: 2,
    parentKey: "general_admin_expenses",
  },

  // Depreciation & Amortization
  {
    key: "depreciation_amortization",
    name: "Depreciation & Amortization",
    nameAr: "الإهلاك والاستنفاد",
    category: "expense",
    isSubtotal: true,
    indent: 1,
    expandable: true,
    parentKey: "operating_expenses",
  },
  {
    key: "building_depreciation",
    name: "Building Depreciation",
    nameAr: "إهلاك المباني",
    category: "expense",
    indent: 2,
    parentKey: "depreciation_amortization",
  },
  {
    key: "equipment_depreciation",
    name: "Equipment Depreciation",
    nameAr: "إهلاك المعدات",
    category: "expense",
    indent: 2,
    parentKey: "depreciation_amortization",
  },
  {
    key: "vehicle_depreciation",
    name: "Vehicle Depreciation",
    nameAr: "إهلاك السيارات",
    category: "expense",
    indent: 2,
    parentKey: "depreciation_amortization",
  },
  {
    key: "intangible_amortization",
    name: "Intangible Asset Amortization",
    nameAr: "استنفاد الأصول غير الملموسة",
    category: "expense",
    indent: 2,
    parentKey: "depreciation_amortization",
  },

  // ═══ OPERATING INCOME / EBIT (calculated) ═══
  {
    key: "operating_income",
    name: "Operating Income (EBIT)",
    nameAr: "الدخل التشغيلي EBIT",
    category: "profit",
    isSubtotal: true,
    indent: 0,
  },

  // Below-the-line items
  {
    key: "investment_income",
    name: "Investment Income",
    nameAr: "إيرادات الاستثمارات",
    category: "revenue",
    indent: 1,
  },
  {
    key: "islamic_finance_cost",
    name: "Islamic Finance Cost",
    nameAr: "تكلفة التمويل الإسلامي",
    category: "expense",
    indent: 1,
  },
  {
    key: "other_income",
    name: "Other Income",
    nameAr: "إيرادات أخرى",
    category: "revenue",
    indent: 1,
  },
  {
    key: "other_expenses",
    name: "Other Expenses",
    nameAr: "مصروفات أخرى",
    category: "expense",
    indent: 1,
  },

  // ═══ INCOME BEFORE ZAKAT (calculated) ═══
  {
    key: "income_before_zakat",
    name: "Income Before Zakat",
    nameAr: "الدخل قبل الزكاة",
    category: "profit",
    isSubtotal: true,
    indent: 0,
  },

  // Zakat (Islamic tax — 2.5% of zakat base)
  {
    key: "zakat_expense",
    name: "Zakat Expense",
    nameAr: "مصروف الزكاة",
    category: "expense",
    indent: 1,
  },

  // ═══ NET INCOME (calculated) ═══
  {
    key: "net_income",
    name: "Net Income",
    nameAr: "صافي الدخل",
    category: "profit",
    isTotal: true,
    indent: 0,
  },
];

// Keys that are calculated (not entered manually)
export const CALCULATED_KEYS = new Set([
  "gross_profit",
  "operating_income",
  "income_before_zakat",
  "net_income",
]);

// Keys that contribute to depreciation total (for EBITDA)
export const DEPRECIATION_KEYS = [
  "building_depreciation",
  "equipment_depreciation",
  "vehicle_depreciation",
  "intangible_amortization",
];

// Parent keys for expandable sections
export const EXPANDABLE_PARENT_KEYS = new Set([
  "revenue",
  "cost_of_goods_sold",
  "operating_expenses",
  "selling_expenses",
  "general_admin_expenses",
  "depreciation_amortization",
]);

export function getLineItem(key: string): PnLLineItemDef | undefined {
  return PNL_LINE_ITEMS.find((item) => item.key === key);
}

export function getChildKeys(parentKey: string): string[] {
  return PNL_LINE_ITEMS.filter((item) => item.parentKey === parentKey).map(
    (item) => item.key
  );
}
