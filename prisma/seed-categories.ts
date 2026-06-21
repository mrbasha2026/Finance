import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Full P&L hierarchy to seed into the database.
// Order matters: parents must be inserted before children.
const ITEMS = [
  // ═══ REVENUE ═══
  { pnlKey: "revenue", name: "Revenue", nameAr: "الإيرادات", type: "revenue", isTotal: true, isCalculated: false, sortOrder: 10 },
  { pnlKey: "sales_revenue", name: "Sales Revenue", nameAr: "إيرادات المبيعات", type: "revenue", parentKey: "revenue", sortOrder: 11 },
  { pnlKey: "service_revenue", name: "Service Revenue", nameAr: "إيرادات الخدمات", type: "revenue", parentKey: "revenue", sortOrder: 12 },
  { pnlKey: "other_revenue", name: "Other Revenue", nameAr: "إيرادات أخرى", type: "revenue", parentKey: "revenue", sortOrder: 13 },

  // ═══ COST OF GOODS SOLD ═══
  { pnlKey: "cost_of_goods_sold", name: "Cost of Goods Sold", nameAr: "تكلفة البضاعة المباعة", type: "expense", isSubtotal: true, isCalculated: false, sortOrder: 20 },
  { pnlKey: "raw_materials", name: "Raw Materials", nameAr: "المواد الخام", type: "expense", parentKey: "cost_of_goods_sold", sortOrder: 21 },
  { pnlKey: "direct_labor", name: "Direct Labor", nameAr: "العمالة المباشرة", type: "expense", parentKey: "cost_of_goods_sold", sortOrder: 22 },
  { pnlKey: "manufacturing_overhead", name: "Manufacturing Overhead", nameAr: "مصروفات التصنيع غير المباشرة", type: "expense", parentKey: "cost_of_goods_sold", sortOrder: 23 },
  { pnlKey: "purchases", name: "Purchases", nameAr: "المشتريات", type: "expense", parentKey: "cost_of_goods_sold", sortOrder: 24 },

  // ═══ GROSS PROFIT (formula-based) ═══
  { pnlKey: "gross_profit", name: "Gross Profit", nameAr: "إجمالي الربح", type: "profit", isSubtotal: true, isCalculated: true, sortOrder: 30 },

  // ═══ OPERATING EXPENSES ═══
  { pnlKey: "operating_expenses", name: "Operating Expenses", nameAr: "المصروفات التشغيلية", type: "expense", isTotal: true, isCalculated: false, sortOrder: 40 },

  // Selling
  { pnlKey: "selling_expenses", name: "Selling & Marketing", nameAr: "مصروفات البيع والتسويق", type: "expense", isSubtotal: true, parentKey: "operating_expenses", sortOrder: 41 },
  { pnlKey: "sales_commissions", name: "Sales Commissions", nameAr: "عمولات المبيعات", type: "expense", parentKey: "selling_expenses", sortOrder: 42 },
  { pnlKey: "advertising_promotion", name: "Advertising & Promotion", nameAr: "الإعلان والترويج", type: "expense", parentKey: "selling_expenses", sortOrder: 43 },
  { pnlKey: "marketing_expenses", name: "Marketing Expenses", nameAr: "مصروفات التسويق", type: "expense", parentKey: "selling_expenses", sortOrder: 44 },
  { pnlKey: "delivery_shipping", name: "Delivery & Shipping", nameAr: "التوصيل والشحن", type: "expense", parentKey: "selling_expenses", sortOrder: 45 },
  { pnlKey: "customer_service", name: "Customer Service", nameAr: "خدمة العملاء", type: "expense", parentKey: "selling_expenses", sortOrder: 46 },

  // G&A
  { pnlKey: "general_admin_expenses", name: "General & Administrative", nameAr: "المصروفات الإدارية والعمومية", type: "expense", isSubtotal: true, parentKey: "operating_expenses", sortOrder: 50 },
  { pnlKey: "salaries_wages", name: "Salaries & Wages", nameAr: "الرواتب والأجور", type: "expense", parentKey: "general_admin_expenses", sortOrder: 51 },
  { pnlKey: "employee_benefits", name: "Employee Benefits", nameAr: "بدلات ومزايا الموظفين", type: "expense", parentKey: "general_admin_expenses", sortOrder: 52 },
  { pnlKey: "gosi_subscriptions", name: "GOSI Subscriptions", nameAr: "اشتراكات GOSI", type: "expense", parentKey: "general_admin_expenses", sortOrder: 53 },
  { pnlKey: "rent", name: "Rent", nameAr: "الإيجارات", type: "expense", parentKey: "general_admin_expenses", sortOrder: 54 },
  { pnlKey: "utilities", name: "Utilities", nameAr: "المرافق", type: "expense", parentKey: "general_admin_expenses", sortOrder: 55 },
  { pnlKey: "communications", name: "Communications", nameAr: "الاتصالات", type: "expense", parentKey: "general_admin_expenses", sortOrder: 56 },
  { pnlKey: "stationery", name: "Stationery & Office Supplies", nameAr: "القرطاسية", type: "expense", parentKey: "general_admin_expenses", sortOrder: 57 },
  { pnlKey: "professional_fees", name: "Professional Fees", nameAr: "الأتعاب المهنية", type: "expense", parentKey: "general_admin_expenses", sortOrder: 58 },
  { pnlKey: "travel_hospitality", name: "Travel & Hospitality", nameAr: "السفر والضيافة", type: "expense", parentKey: "general_admin_expenses", sortOrder: 59 },
  { pnlKey: "insurance", name: "Insurance", nameAr: "التأمين", type: "expense", parentKey: "general_admin_expenses", sortOrder: 60 },
  { pnlKey: "maintenance", name: "Maintenance & Repairs", nameAr: "الصيانة", type: "expense", parentKey: "general_admin_expenses", sortOrder: 61 },
  { pnlKey: "licenses", name: "Licenses & Permits", nameAr: "التراخيص", type: "expense", parentKey: "general_admin_expenses", sortOrder: 62 },
  { pnlKey: "subscriptions_software", name: "Subscriptions & Software", nameAr: "الاشتراكات والبرمجيات", type: "expense", parentKey: "general_admin_expenses", sortOrder: 63 },
  { pnlKey: "bad_debts", name: "Bad Debts", nameAr: "الديون المعدومة", type: "expense", parentKey: "general_admin_expenses", sortOrder: 64 },
  { pnlKey: "miscellaneous_expenses", name: "Miscellaneous Expenses", nameAr: "مصروفات متنوعة", type: "expense", parentKey: "general_admin_expenses", sortOrder: 65 },

  // D&A
  { pnlKey: "depreciation_amortization", name: "Depreciation & Amortization", nameAr: "الإهلاك والاستنفاد", type: "expense", isSubtotal: true, parentKey: "operating_expenses", sortOrder: 70 },
  { pnlKey: "building_depreciation", name: "Building Depreciation", nameAr: "إهلاك المباني", type: "expense", parentKey: "depreciation_amortization", sortOrder: 71 },
  { pnlKey: "equipment_depreciation", name: "Equipment Depreciation", nameAr: "إهلاك المعدات", type: "expense", parentKey: "depreciation_amortization", sortOrder: 72 },
  { pnlKey: "vehicle_depreciation", name: "Vehicle Depreciation", nameAr: "إهلاك السيارات", type: "expense", parentKey: "depreciation_amortization", sortOrder: 73 },
  { pnlKey: "intangible_amortization", name: "Intangible Amortization", nameAr: "استنفاد الأصول غير الملموسة", type: "expense", parentKey: "depreciation_amortization", sortOrder: 74 },

  // ═══ OPERATING INCOME (formula-based) ═══
  { pnlKey: "operating_income", name: "Operating Income (EBIT)", nameAr: "الدخل التشغيلي EBIT", type: "profit", isSubtotal: true, isCalculated: true, sortOrder: 80 },

  // ═══ BELOW THE LINE ═══
  { pnlKey: "investment_income", name: "Investment Income", nameAr: "إيرادات الاستثمارات", type: "revenue", sortOrder: 90 },
  { pnlKey: "islamic_finance_cost", name: "Islamic Finance Cost", nameAr: "تكلفة التمويل الإسلامي", type: "expense", sortOrder: 91 },
  { pnlKey: "other_income", name: "Other Income", nameAr: "إيرادات أخرى", type: "revenue", sortOrder: 92 },
  { pnlKey: "other_expenses", name: "Other Expenses", nameAr: "مصروفات أخرى", type: "expense", sortOrder: 93 },

  // ═══ INCOME BEFORE ZAKAT (formula-based) ═══
  { pnlKey: "income_before_zakat", name: "Income Before Zakat", nameAr: "الدخل قبل الزكاة", type: "profit", isSubtotal: true, isCalculated: true, sortOrder: 95 },

  // Zakat
  { pnlKey: "zakat_expense", name: "Zakat Expense", nameAr: "مصروف الزكاة", type: "expense", sortOrder: 96 },

  // ═══ NET INCOME (formula-based) ═══
  { pnlKey: "net_income", name: "Net Income", nameAr: "صافي الدخل", type: "profit", isTotal: true, isCalculated: true, sortOrder: 100 },
];

async function main() {
  console.log("Seeding P&L categories...");

  // Clear only categories with no companyId (system-wide ones)
  await prisma.category.deleteMany({ where: { companyId: null } });

  // First pass: insert all items, collect id map
  const keyToId = new Map<string, string>();

  // Insert roots first (no parentKey), then children
  const roots = ITEMS.filter((i) => !i.parentKey);
  const children = ITEMS.filter((i) => !!i.parentKey);

  for (const item of roots) {
    const created = await prisma.category.create({
      data: {
        name: item.name,
        nameAr: item.nameAr,
        type: item.type,
        pnlKey: item.pnlKey,
        sortOrder: item.sortOrder,
        isCalculated: item.isCalculated ?? false,
        isTotal: item.isTotal ?? false,
        isSubtotal: item.isSubtotal ?? false,
      },
    });
    keyToId.set(item.pnlKey, created.id);
  }

  // Insert children in order (handles multi-level since ITEMS is ordered)
  for (const item of children) {
    const parentId = keyToId.get(item.parentKey!);
    if (!parentId) {
      console.warn(`Parent not found for ${item.pnlKey} (parentKey: ${item.parentKey})`);
      continue;
    }
    const created = await prisma.category.create({
      data: {
        name: item.name,
        nameAr: item.nameAr,
        type: item.type,
        parentId,
        pnlKey: item.pnlKey,
        sortOrder: item.sortOrder,
        isCalculated: item.isCalculated ?? false,
        isTotal: item.isTotal ?? false,
        isSubtotal: item.isSubtotal ?? false,
      },
    });
    keyToId.set(item.pnlKey, created.id);
  }

  console.log(`Seeded ${ITEMS.length} P&L categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
