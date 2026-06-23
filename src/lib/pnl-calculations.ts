import { CompanyPnL, PnLKPIs, PeriodType, PeriodGroup } from "./pnl-types";
import { DynamicCategory, catKey, isLeaf, FORMULA_KEYS } from "./category-types";

export function calculateKPIs(data: Record<string, number>): PnLKPIs {
  const revenue = data["revenue"] ?? 0;

  // Support both old key (cost_of_goods_sold) and IFRS key (cost_of_sales)
  const cogs = (data["cost_of_sales"] ?? 0) || (data["cost_of_goods_sold"] ?? 0);
  const grossProfit = data["gross_profit"] ?? (revenue - cogs);

  const operatingIncome = data["operating_income"] ?? 0;

  // EBITDA = Operating Income + D&A
  const daTotal = data["depreciation_amortization"] ?? 0;
  const ebitda = operatingIncome + daTotal;

  const incomeBeforeZakat = data["income_before_zakat"] ?? 0;
  const netIncome = data["net_income"] ?? 0;

  const safe = (n: number, d: number) =>
    d === 0 ? 0 : Math.round((n / d) * 10000) / 100;

  return {
    revenue,
    grossProfit,
    grossMargin: safe(grossProfit, revenue),
    ebitda,
    ebitdaMargin: safe(ebitda, revenue),
    operatingIncome,
    operatingMargin: safe(operatingIncome, revenue),
    netIncome,
    netMargin: safe(netIncome, revenue),
  };
}

// Infer calculated rows from raw input
export function inferCalculatedRows(
  raw: Record<string, number>
): Record<string, number> {
  const data = { ...raw };

  // Revenue total
  data["revenue"] =
    (data["sales_revenue"] ?? 0) +
    (data["service_revenue"] ?? 0) +
    (data["other_revenue"] ?? 0);

  // COGS total
  data["cost_of_goods_sold"] =
    (data["raw_materials"] ?? 0) +
    (data["direct_labor"] ?? 0) +
    (data["manufacturing_overhead"] ?? 0) +
    (data["purchases"] ?? 0);

  // Gross profit
  data["gross_profit"] = data["revenue"] - data["cost_of_goods_sold"];

  // Selling expenses subtotal
  data["selling_expenses"] =
    (data["sales_commissions"] ?? 0) +
    (data["advertising_promotion"] ?? 0) +
    (data["marketing_expenses"] ?? 0) +
    (data["delivery_shipping"] ?? 0) +
    (data["customer_service"] ?? 0);

  // G&A subtotal
  data["general_admin_expenses"] =
    (data["salaries_wages"] ?? 0) +
    (data["employee_benefits"] ?? 0) +
    (data["gosi_subscriptions"] ?? 0) +
    (data["rent"] ?? 0) +
    (data["utilities"] ?? 0) +
    (data["communications"] ?? 0) +
    (data["stationery"] ?? 0) +
    (data["professional_fees"] ?? 0) +
    (data["travel_hospitality"] ?? 0) +
    (data["insurance"] ?? 0) +
    (data["maintenance"] ?? 0) +
    (data["licenses"] ?? 0) +
    (data["subscriptions_software"] ?? 0) +
    (data["bad_debts"] ?? 0) +
    (data["miscellaneous_expenses"] ?? 0);

  // D&A subtotal
  data["depreciation_amortization"] =
    (data["building_depreciation"] ?? 0) +
    (data["equipment_depreciation"] ?? 0) +
    (data["vehicle_depreciation"] ?? 0) +
    (data["intangible_amortization"] ?? 0);

  // Operating expenses total
  data["operating_expenses"] =
    data["selling_expenses"] +
    data["general_admin_expenses"] +
    data["depreciation_amortization"];

  // Operating income (EBIT)
  data["operating_income"] = data["gross_profit"] - data["operating_expenses"];

  // Income before zakat
  data["income_before_zakat"] =
    data["operating_income"] +
    (data["investment_income"] ?? 0) -
    (data["islamic_finance_cost"] ?? 0) +
    (data["other_income"] ?? 0) -
    (data["other_expenses"] ?? 0);

  // Net income
  data["net_income"] = data["income_before_zakat"] - (data["zakat_expense"] ?? 0);

  return data;
}

// Aggregate multiple months of data by summing
export function aggregateData(
  datasets: CompanyPnL[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const ds of datasets) {
    for (const [key, val] of Object.entries(ds.data)) {
      result[key] = (result[key] ?? 0) + val;
    }
  }
  return result;
}

// Group periods by period type
export function groupPeriods(
  months: string[],
  type: PeriodType
): PeriodGroup[] {
  const sorted = [...months].sort();

  if (type === "monthly") {
    return sorted.map((m) => ({
      key: m,
      labelAr: formatPeriodAr(m, "monthly"),
      months: [m],
    }));
  }

  const groups: Record<string, string[]> = {};

  for (const m of sorted) {
    const [year, monthStr] = m.split("-");
    const month = parseInt(monthStr, 10);
    let groupKey: string;

    if (type === "quarterly") {
      const q = Math.ceil(month / 3);
      groupKey = `${year}-Q${q}`;
    } else if (type === "semi-annual") {
      const h = month <= 6 ? 1 : 2;
      groupKey = `${year}-H${h}`;
    } else {
      groupKey = year;
    }

    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(m);
  }

  return Object.entries(groups).map(([key, months]) => ({
    key,
    labelAr: formatPeriodAr(key, type),
    months,
  }));
}

export function formatPeriodAr(key: string, type: PeriodType): string {
  const AR_MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  if (type === "monthly") {
    const [year, m] = key.split("-");
    return `${AR_MONTHS[parseInt(m, 10) - 1]} ${year}`;
  }
  if (type === "quarterly") {
    const [year, q] = key.split("-Q");
    const labels = ["الربع الأول", "الربع الثاني", "الربع الثالث", "الربع الرابع"];
    return `${labels[parseInt(q, 10) - 1]} ${year}`;
  }
  if (type === "semi-annual") {
    const [year, h] = key.split("-H");
    const labels = ["النصف الأول", "النصف الثاني"];
    return `${labels[parseInt(h, 10) - 1]} ${year}`;
  }
  // annual
  return `سنة ${key}`;
}

export function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100;
}

// ─── Dynamic calculation engine ───────────────────────────────────────────────
// Recursively sums leaf descendants for every non-leaf, non-formula category.
// Then applies the 4 fixed formulas for profit rows.
export function inferDynamic(
  raw: Record<string, number>,
  categories: DynamicCategory[],
  zakatRate = 0.025
): Record<string, number> {
  const data: Record<string, number> = { ...raw };

  // Build tree from flat list so children[] is always populated regardless of API shape
  const nodeMap = new Map<string, DynamicCategory>();
  categories.forEach((c) => nodeMap.set(c.id, { ...c, children: [] }));
  const roots: DynamicCategory[] = [];
  categories.forEach((c) => {
    const node = nodeMap.get(c.id)!;
    if (c.parentId && nodeMap.has(c.parentId)) nodeMap.get(c.parentId)!.children.push(node);
    else if (!c.parentId) roots.push(node);
  });

  // Bottom-up: sum children recursively
  function sumNode(cat: DynamicCategory): number {
    if (FORMULA_KEYS.has(cat.pnlKey ?? "")) return data[catKey(cat)] ?? 0;
    if (cat.children.length === 0) return data[catKey(cat)] ?? 0;
    const childSum = cat.children.reduce((acc, child) => acc + sumNode(child), 0);
    // If children have no data, preserve any value stored directly on this category.
    // This handles accounts that were mapped to a parent pnlKey instead of a leaf.
    const total = childSum !== 0 ? childSum : (raw[catKey(cat)] ?? 0);
    data[catKey(cat)] = total;
    return total;
  }

  for (const root of roots) {
    if (!FORMULA_KEYS.has(root.pnlKey ?? "")) sumNode(root);
  }

  // ── Fixed formulas (IFRS IAS 1 structure) ──────────────────────────────────

  // Gross Profit = Revenue - Cost of Sales (IFRS key) or Cost of Goods Sold (legacy)
  const costOfSales = (data["cost_of_sales"] ?? 0) || (data["cost_of_goods_sold"] ?? 0);
  data["gross_profit"] = (data["revenue"] ?? 0) - costOfSales;

  // Operating Income (EBIT) = GP - each expense category at root level
  // Supports both IFRS flat structure and old nested structure
  const sellingExp = (data["selling_distribution_expenses"] ?? 0) || (data["selling_expenses"] ?? 0);
  const gaExp = data["general_admin_expenses"] ?? 0;
  const rdExp = data["research_development"] ?? 0;
  const daExp = data["depreciation_amortization"] ?? 0;
  // Old structure had operating_expenses as a parent; new IFRS has them flat
  const opexLegacy = data["operating_expenses"] ?? 0;
  const opexIfrs = sellingExp + gaExp + rdExp + daExp;
  data["operating_income"] = data["gross_profit"] - (opexIfrs > 0 ? opexIfrs : opexLegacy);

  // Income Before Zakat = OI + Finance Income - Finance Costs + Share of Associates
  const financeIncome = (data["finance_income"] ?? 0)
    || ((data["investment_income"] ?? 0) + (data["other_income"] ?? 0));
  const financeCosts = (data["finance_costs"] ?? 0)
    || ((data["islamic_finance_cost"] ?? 0) + (data["other_expenses"] ?? 0));
  const shareAssociates = data["share_of_associates"] ?? 0;
  data["income_before_zakat"] =
    data["operating_income"] + financeIncome - financeCosts + shareAssociates;

  // Auto-suggest zakat if not entered
  if (!raw["zakat_expense"] && data["income_before_zakat"] > 0) {
    data["zakat_expense"] = +(data["income_before_zakat"] * zakatRate).toFixed(2);
  }

  data["net_income"] = data["income_before_zakat"] - (data["zakat_expense"] ?? 0);

  // Total Comprehensive Income = Net Income + OCI
  data["total_comprehensive_income"] =
    (data["net_income"] ?? 0) + (data["other_comprehensive_income"] ?? 0);

  // Normalize IFRS↔legacy key aliases so display components find values
  // regardless of which key variant the user's categories use
  data["cost_of_goods_sold"] = (data["cost_of_goods_sold"] ?? 0) || (data["cost_of_sales"] ?? 0);
  data["cost_of_sales"] = data["cost_of_goods_sold"];
  data["selling_expenses"] = (data["selling_expenses"] ?? 0) || (data["selling_distribution_expenses"] ?? 0);
  data["selling_distribution_expenses"] = data["selling_expenses"];

  return data;
}
