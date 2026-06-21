import { describe, it, expect } from "vitest";
import { inferDynamic, aggregateData, calculateKPIs } from "@/lib/pnl-calculations";
import { DynamicCategory } from "@/lib/category-types";
import type { CompanyPnL } from "@/lib/pnl-types";

// ── مساعد لإنشاء تصنيف اختباري ────────────────────────────────────────────────
function makeCategory(overrides: Partial<DynamicCategory> & { id: string; name: string; nameAr: string }): DynamicCategory {
  return {
    type: "expense",
    parentId: null,
    pnlKey: overrides.id,
    sortOrder: 0,
    isCalculated: false,
    isTotal: false,
    isSubtotal: false,
    children: [],
    ...overrides,
  };
}

// ── مجموعة 1: تأثير إضافة تصنيف جديد على inferDynamic ────────────────────────
describe("inferDynamic — إضافة تصنيف جديد وتأثيره على التقارير", () => {

  it("تصنيف ورقة جديد: تمرير قيمته مباشرةً في النتيجة", () => {
    const categories: DynamicCategory[] = [
      makeCategory({ id: "marketing_new", name: "Marketing New", nameAr: "تسويق جديد", pnlKey: "marketing_new" }),
    ];

    const raw = { marketing_new: 5000 };
    const result = inferDynamic(raw, categories);

    expect(result["marketing_new"]).toBe(5000);
  });

  it("تصنيف أب جديد: يُجمع قيم أبنائه تلقائياً", () => {
    const parent = makeCategory({ id: "p1", name: "OpEx", nameAr: "مصروفات تشغيل", pnlKey: "opex_group" });
    const child1 = makeCategory({ id: "c1", name: "Salaries", nameAr: "رواتب", pnlKey: "salaries_new", parentId: "p1" });
    const child2 = makeCategory({ id: "c2", name: "Rent", nameAr: "إيجار", pnlKey: "rent_new", parentId: "p1" });
    parent.children = [child1, child2];

    const categories: DynamicCategory[] = [parent, child1, child2];
    const raw = { salaries_new: 10000, rent_new: 3000 };

    const result = inferDynamic(raw, categories);

    expect(result["opex_group"]).toBe(13000);
  });

  it("تصنيف إيراد جديد تحت revenue: يرفع الإيرادات الإجمالية", () => {
    const revenue = makeCategory({ id: "rev", name: "Revenue", nameAr: "الإيرادات", pnlKey: "revenue", type: "revenue" });
    const child = makeCategory({ id: "new_service", name: "New Service", nameAr: "خدمة جديدة", pnlKey: "new_service", type: "revenue", parentId: "rev" });
    revenue.children = [child];

    const categories = [revenue, child];
    const raw = { new_service: 20000 };

    const result = inferDynamic(raw, categories);

    // الأب "revenue" يُجمع أبناءه
    expect(result["revenue"]).toBe(20000);
  });

  it("تصنيف تكلفة جديد: يؤثر على gross_profit عبر المعادلة الثابتة", () => {
    const costOfSales = makeCategory({ id: "cost_of_sales", name: "Cost of Sales", nameAr: "تكلفة المبيعات", pnlKey: "cost_of_sales" });
    const newCost = makeCategory({ id: "extra_cost", name: "Extra Cost", nameAr: "تكلفة إضافية", pnlKey: "extra_cost", parentId: "cost_of_sales" });
    costOfSales.children = [newCost];

    const categories = [
      makeCategory({ id: "revenue", name: "Revenue", nameAr: "الإيرادات", pnlKey: "revenue", type: "revenue" }),
      costOfSales,
      newCost,
    ];

    const raw = { revenue: 100000, extra_cost: 40000 };
    const result = inferDynamic(raw, categories);

    // gross_profit = revenue - cost_of_sales = 100000 - 40000 = 60000
    expect(result["cost_of_sales"]).toBe(40000);
    expect(result["gross_profit"]).toBe(60000);
  });

  it("تصنيف مصروف جديد: يُخفّض operating_income", () => {
    const gaParent = makeCategory({ id: "general_admin_expenses", name: "G&A", nameAr: "مصروفات إدارية", pnlKey: "general_admin_expenses" });
    const newExp = makeCategory({ id: "legal_fees", name: "Legal Fees", nameAr: "رسوم قانونية", pnlKey: "legal_fees", parentId: "general_admin_expenses" });
    gaParent.children = [newExp];

    const categories = [
      makeCategory({ id: "revenue", name: "Revenue", nameAr: "الإيرادات", pnlKey: "revenue", type: "revenue" }),
      makeCategory({ id: "cost_of_sales", name: "COGS", nameAr: "تكلفة", pnlKey: "cost_of_sales" }),
      gaParent,
      newExp,
    ];

    const raw = { revenue: 50000, cost_of_sales: 20000, legal_fees: 5000 };
    const result = inferDynamic(raw, categories);

    // gross_profit = 50000 - 20000 = 30000
    // general_admin_expenses = 5000
    // operating_income = 30000 - 5000 = 25000
    expect(result["general_admin_expenses"]).toBe(5000);
    expect(result["gross_profit"]).toBe(30000);
    expect(result["operating_income"]).toBe(25000);
  });

  it("تصنيف بدون قيمة: لا يؤثر على الحسابات (قيمته صفر)", () => {
    const categories = [
      makeCategory({ id: "new_empty_cat", name: "Empty", nameAr: "فارغ", pnlKey: "new_empty_cat" }),
    ];

    const raw = {};
    const result = inferDynamic(raw, categories);

    expect(result["new_empty_cat"] ?? 0).toBe(0);
  });

  it("تصنيفات متعددة المستويات: الجد يجمع الأحفاد بشكل صحيح", () => {
    const grandparent = makeCategory({ id: "gp", name: "GP", nameAr: "جد", pnlKey: "grand_total" });
    const parent1 = makeCategory({ id: "p1", name: "P1", nameAr: "أب1", pnlKey: "parent_1", parentId: "gp" });
    const parent2 = makeCategory({ id: "p2", name: "P2", nameAr: "أب2", pnlKey: "parent_2", parentId: "gp" });
    const leaf1 = makeCategory({ id: "l1", name: "L1", nameAr: "ورقة1", pnlKey: "leaf_1", parentId: "p1" });
    const leaf2 = makeCategory({ id: "l2", name: "L2", nameAr: "ورقة2", pnlKey: "leaf_2", parentId: "p2" });

    parent1.children = [leaf1];
    parent2.children = [leaf2];
    grandparent.children = [parent1, parent2];

    const categories = [grandparent, parent1, parent2, leaf1, leaf2];
    const raw = { leaf_1: 7000, leaf_2: 3000 };

    const result = inferDynamic(raw, categories);

    expect(result["parent_1"]).toBe(7000);
    expect(result["parent_2"]).toBe(3000);
    expect(result["grand_total"]).toBe(10000);
  });
});

// ── مجموعة 2: aggregateData ───────────────────────────────────────────────────
describe("aggregateData — تجميع فترات متعددة", () => {
  it("يجمع قيم نفس المفتاح من فترتين", () => {
    const datasets: CompanyPnL[] = [
      { id: "1", companyId: "c1", companyName: "شركة", period: "2024-01", currency: "SAR", data: { revenue: 10000, marketing_new: 1000 } },
      { id: "2", companyId: "c1", companyName: "شركة", period: "2024-02", currency: "SAR", data: { revenue: 12000, marketing_new: 1500 } },
    ];

    const result = aggregateData(datasets);

    expect(result["revenue"]).toBe(22000);
    expect(result["marketing_new"]).toBe(2500);
  });

  it("مفتاح موجود في فترة واحدة فقط: يظهر بنفس القيمة", () => {
    const datasets: CompanyPnL[] = [
      { id: "1", companyId: "c1", companyName: "شركة", period: "2024-01", currency: "SAR", data: { revenue: 5000 } },
      { id: "2", companyId: "c1", companyName: "شركة", period: "2024-02", currency: "SAR", data: { new_category: 2000 } },
    ];

    const result = aggregateData(datasets);

    expect(result["revenue"]).toBe(5000);
    expect(result["new_category"]).toBe(2000);
  });
});

// ── مجموعة 3: تأثير التصنيف على calculateKPIs ────────────────────────────────
describe("calculateKPIs — تأثير تصنيف جديد على مؤشرات الأداء", () => {
  it("إضافة إيراد جديد: ترتفع revenue وتتحسن جميع الهوامش", () => {
    const base = inferDynamic({ revenue: 100000, cost_of_sales: 50000 }, []);
    const withNew = inferDynamic({ revenue: 120000, cost_of_sales: 50000 }, []);

    const kpisBase = calculateKPIs(base);
    const kpisNew  = calculateKPIs(withNew);

    expect(kpisNew.revenue).toBeGreaterThan(kpisBase.revenue);
    expect(kpisNew.grossMargin).toBeGreaterThan(kpisBase.grossMargin);
  });

  it("إضافة مصروف جديد: ينخفض net_income وتنخفض الهوامش", () => {
    const base = inferDynamic({ revenue: 100000, cost_of_sales: 40000 }, []);
    const withNewExp = inferDynamic({ revenue: 100000, cost_of_sales: 40000, general_admin_expenses: 20000 }, []);

    const kpisBase   = calculateKPIs(base);
    const kpisNewExp = calculateKPIs(withNewExp);

    expect(kpisNewExp.operatingIncome).toBeLessThan(kpisBase.operatingIncome);
    expect(kpisNewExp.netIncome).toBeLessThan(kpisBase.netIncome);
  });

  it("صافي ربح صفر عند تساوي الإيرادات والمصروفات", () => {
    const result = inferDynamic({
      revenue: 50000,
      cost_of_sales: 30000,
      general_admin_expenses: 20000,
    }, []);

    const kpis = calculateKPIs(result);
    expect(kpis.grossProfit).toBe(20000);
    expect(kpis.operatingIncome).toBe(0);
  });
});
