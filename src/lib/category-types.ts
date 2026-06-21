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

// Returns the storage key for a category
export function catKey(cat: DynamicCategory): string {
  return cat.pnlKey ?? cat.id;
}

// Returns true when a category is a leaf (input field in PnL form)
export function isLeaf(cat: DynamicCategory): boolean {
  return (cat.children?.length ?? 0) === 0 && !FORMULA_KEYS.has(cat.pnlKey ?? "");
}
