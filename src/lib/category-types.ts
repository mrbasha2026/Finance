export interface DynamicCategory {
  id: string;
  name: string;
  nameAr: string;
  type: string;
  parentId: string | null;
  pnlKey: string | null;
  sortOrder: number;
  isCalculated: boolean;
  isTotal: boolean;
  isSubtotal: boolean;
  children: DynamicCategory[];
}

// Rows whose values come from fixed formulas (not sum-of-children)
export const FORMULA_KEYS = new Set([
  "gross_profit",
  "operating_income",
  "income_before_zakat",
  "net_income",
  "total_comprehensive_income",
]);

// All keys that inferDynamic depends on — cannot be deleted (but can be renamed)
export const SYSTEM_KEYS = new Set([
  // Formula keys
  "gross_profit",
  "operating_income",
  "income_before_zakat",
  "net_income",
  "total_comprehensive_income",
  // Revenue
  "revenue",
  // Cost of Sales (IFRS + legacy)
  "cost_of_sales",
  "cost_of_goods_sold",
  // Operating Expenses
  "selling_distribution_expenses",
  "selling_expenses",
  "general_admin_expenses",
  "research_development",
  "depreciation_amortization",
  // Finance
  "finance_income",
  "finance_costs",
  // Zakat & Comprehensive Income
  "zakat_expense",
  "other_comprehensive_income",
  "share_of_associates",
]);

// Returns the storage key for a category
export function catKey(cat: DynamicCategory): string {
  return cat.pnlKey ?? cat.id;
}

// Returns true when a category is a leaf (input field in PnL form)
export function isLeaf(cat: DynamicCategory): boolean {
  return (cat.children?.length ?? 0) === 0 && !FORMULA_KEYS.has(cat.pnlKey ?? "");
}
