import { describe, it, expect } from "vitest";
import { catKey, isLeaf, FORMULA_KEYS, DynamicCategory } from "@/lib/category-types";

// مساعد لإنشاء تصنيف اختباري
function makeCategory(overrides: Partial<DynamicCategory> & { id: string; name: string; nameAr: string }): DynamicCategory {
  return {
    type: "expense",
    parentId: null,
    pnlKey: null,
    sortOrder: 0,
    isCalculated: false,
    isTotal: false,
    isSubtotal: false,
    children: [],
    ...overrides,
  };
}

// ── مجموعة 1: catKey — مفتاح الربط بين التصنيف والبيانات المالية ──────────────
describe("catKey — ربط التصنيف بمفتاح التخزين", () => {
  it("يُعيد pnlKey عندما يكون موجوداً", () => {
    const cat = makeCategory({ id: "cat1", name: "Revenue", nameAr: "إيرادات", pnlKey: "revenue" });
    expect(catKey(cat)).toBe("revenue");
  });

  it("يُعيد id عندما يكون pnlKey فارغاً (null)", () => {
    const cat = makeCategory({ id: "cat_abc123", name: "Custom", nameAr: "مخصص", pnlKey: null });
    expect(catKey(cat)).toBe("cat_abc123");
  });

  it("تصنيفان مختلفان لا يتشاركان نفس المفتاح", () => {
    const cat1 = makeCategory({ id: "c1", name: "Sales", nameAr: "مبيعات", pnlKey: "sales_revenue" });
    const cat2 = makeCategory({ id: "c2", name: "Service", nameAr: "خدمات", pnlKey: "service_revenue" });
    expect(catKey(cat1)).not.toBe(catKey(cat2));
  });

  it("تصنيف بـ pnlKey يربط مباشرة ببيانات PnL في القاموس", () => {
    const cat = makeCategory({ id: "c3", name: "Marketing", nameAr: "تسويق", pnlKey: "marketing_expenses" });
    const pnlData: Record<string, number> = { marketing_expenses: 5000 };

    // يجب أن يُجد قيمة التصنيف من القاموس عبر catKey
    expect(pnlData[catKey(cat)]).toBe(5000);
  });
});

// ── مجموعة 2: isLeaf — التعرف على تصنيفات الإدخال ───────────────────────────
describe("isLeaf — التعرف على تصنيفات الإدخال المباشر", () => {
  it("تصنيف بلا أبناء وليس في FORMULA_KEYS: هو ورقة", () => {
    const cat = makeCategory({ id: "c1", name: "Salaries", nameAr: "رواتب", pnlKey: "salaries_new", children: [] });
    expect(isLeaf(cat)).toBe(true);
  });

  it("تصنيف له أبناء: ليس ورقة", () => {
    const child = makeCategory({ id: "ch1", name: "Child", nameAr: "ابن", pnlKey: "child_key" });
    const parent = makeCategory({ id: "p1", name: "Parent", nameAr: "أب", pnlKey: "parent_key", children: [child] });
    expect(isLeaf(parent)).toBe(false);
  });

  it("تصنيف بمفتاح معادلة: ليس ورقة حتى لو بلا أبناء", () => {
    for (const formulaKey of FORMULA_KEYS) {
      const cat = makeCategory({ id: formulaKey, name: formulaKey, nameAr: formulaKey, pnlKey: formulaKey, children: [] });
      expect(isLeaf(cat)).toBe(false);
    }
  });

  it("تصنيف جديد بـ pnlKey غير موجود في FORMULA_KEYS: يُعدّ ورقة", () => {
    const cat = makeCategory({ id: "new_cat", name: "New Category", nameAr: "تصنيف جديد", pnlKey: "brand_new_key", children: [] });
    expect(FORMULA_KEYS.has("brand_new_key")).toBe(false);
    expect(isLeaf(cat)).toBe(true);
  });
});

// ── مجموعة 3: FORMULA_KEYS — المفاتيح المحمية ──────────────────────────────────
describe("FORMULA_KEYS — المفاتيح المحسوبة بمعادلة ثابتة", () => {
  it("تحتوي على المفاتيح الأساسية للأرباح", () => {
    expect(FORMULA_KEYS.has("gross_profit")).toBe(true);
    expect(FORMULA_KEYS.has("operating_income")).toBe(true);
    expect(FORMULA_KEYS.has("net_income")).toBe(true);
    expect(FORMULA_KEYS.has("income_before_zakat")).toBe(true);
    expect(FORMULA_KEYS.has("total_comprehensive_income")).toBe(true);
  });

  it("تصنيف إيراد جديد لا يكون في FORMULA_KEYS", () => {
    const newCategoryKey = "new_revenue_stream_2024";
    expect(FORMULA_KEYS.has(newCategoryKey)).toBe(false);
  });

  it("تصنيف مصروف جديد لا يكون في FORMULA_KEYS", () => {
    const newExpKey = "legal_compliance_fees";
    expect(FORMULA_KEYS.has(newExpKey)).toBe(false);
  });
});

// ── مجموعة 4: تكامل الربط — التصنيف + القاموس ──────────────────────────────────
describe("تكامل الربط: التصنيف ↔ بيانات التقرير", () => {
  it("سيناريو كامل: تصنيف جديد تحت أب، يُقرأ من قاموس بيانات التقرير", () => {
    const parent = makeCategory({ id: "ga_parent", name: "G&A", nameAr: "مصروفات عمومية", pnlKey: "general_admin_expenses" });
    const newCat = makeCategory({ id: "consulting_fees", name: "Consulting", nameAr: "استشارات", pnlKey: "consulting_fees", parentId: "ga_parent" });
    parent.children = [newCat];

    const pnlData: Record<string, number> = {
      general_admin_expenses: 15000,
      consulting_fees: 5000,
    };

    // التصنيف الجديد هو ورقة → يُقرأ مباشرة من القاموس
    expect(isLeaf(newCat)).toBe(true);
    expect(pnlData[catKey(newCat)]).toBe(5000);

    // الأب ليس ورقة → قيمته محسوبة من أبنائه
    expect(isLeaf(parent)).toBe(false);
    expect(pnlData[catKey(parent)]).toBe(15000);
  });

  it("تصنيف بـ pnlKey مخصص: ينطبق على بيانات موجودة في الـ dataset", () => {
    const cat = makeCategory({ id: "xyz_id", name: "Social Media", nameAr: "تواصل اجتماعي", pnlKey: "social_media_ads" });

    // dataset من Excel
    const dataFromExcel: Record<string, number> = { social_media_ads: 8500 };

    expect(dataFromExcel[catKey(cat)]).toBe(8500);
  });

  it("تصنيف بدون pnlKey: يستخدم id كمفتاح احتياطي في القاموس", () => {
    const cat = makeCategory({ id: "fallback_id_999", name: "Misc", nameAr: "متفرقات", pnlKey: null });

    const pnlData: Record<string, number> = { fallback_id_999: 300 };

    expect(catKey(cat)).toBe("fallback_id_999");
    expect(pnlData[catKey(cat)]).toBe(300);
  });
});
