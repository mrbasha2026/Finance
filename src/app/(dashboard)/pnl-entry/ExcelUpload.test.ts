import { describe, it, expect } from "vitest";
import {
  xlsxDateToStr,
  normalizeAr,
  extractLeaves,
  buildNameMap,
  resolveAccount,
  COL_KEYS,
  type ApiCategory,
  type LeafCategory,
} from "./ExcelUpload.utils";

// ── xlsxDateToStr ──────────────────────────────────────────────────────────────

describe("xlsxDateToStr", () => {
  it("يُرجع تاريخاً صحيحاً بصيغة YYYY-MM-DD لتاريخ عادي", () => {
    const d = new Date(2024, 2, 15, 10, 30, 0); // 15 مارس 2024
    expect(xlsxDateToStr(d)).toBe("2024-03-15");
  });

  it("يُضيف صفراً بادئاً للأشهر الأحادية الرقم", () => {
    const d = new Date(2024, 0, 5, 8, 0, 0); // 5 يناير 2024
    expect(xlsxDateToStr(d)).toBe("2024-01-05");
  });

  it("يُضيف صفراً بادئاً للأيام الأحادية الرقم", () => {
    const d = new Date(2024, 11, 3, 14, 0, 0); // 3 ديسمبر 2024
    expect(xlsxDateToStr(d)).toBe("2024-12-03");
  });

  it("يُصحح خطأ xlsx العشري: الساعة 23:59 تنتقل إلى اليوم التالي", () => {
    // يمثّل هذا خطأ xlsx الشهير حيث يُخزَّن 2024-01-01 كـ 2023-12-31T23:59
    const d = new Date(2023, 11, 31, 23, 59, 58); // 31 ديسمبر 2023 23:59
    expect(xlsxDateToStr(d)).toBe("2024-01-01");
  });

  it("يُصحح تجاوز الشهر عند الساعة 23:59 (آخر يوم في الشهر)", () => {
    const d = new Date(2024, 0, 31, 23, 59, 0); // 31 يناير 23:59
    expect(xlsxDateToStr(d)).toBe("2024-02-01");
  });

  it("يُصحح تجاوز السنة عند الساعة 23:59 في 31 ديسمبر", () => {
    const d = new Date(2024, 11, 31, 23, 59, 0); // 31 ديسمبر 2024 23:59
    expect(xlsxDateToStr(d)).toBe("2025-01-01");
  });

  it("لا يُعدِّل التاريخ عند الساعة 23:00 (ليست 23:59)", () => {
    const d = new Date(2024, 2, 15, 23, 0, 0); // 15 مارس 2024 الساعة 23:00
    expect(xlsxDateToStr(d)).toBe("2024-03-15");
  });

  it("لا يُعدِّل التاريخ عند الساعة 00:00", () => {
    const d = new Date(2024, 5, 1, 0, 0, 0); // 1 يونيو 2024
    expect(xlsxDateToStr(d)).toBe("2024-06-01");
  });
});

// ── normalizeAr ────────────────────────────────────────────────────────────────

describe("normalizeAr", () => {
  it("يُزيل الحركات (التشكيل)", () => {
    expect(normalizeAr("مَصْرُوفَاتٌ")).toBe("مصروفات");
  });

  it("يوحِّد أشكال الألف: أ → ا", () => {
    expect(normalizeAr("أرباح")).toBe("ارباح");
  });

  it("يوحِّد أشكال الألف: إ → ا", () => {
    expect(normalizeAr("إيرادات")).toBe("ايرادات");
  });

  it("يوحِّد أشكال الألف: آ → ا", () => {
    expect(normalizeAr("آلات")).toBe("الات");
  });

  it("يُحوِّل التاء المربوطة ة إلى هاء ه", () => {
    expect(normalizeAr("خزينة")).toBe("خزينه");
  });

  it("يُحوِّل الألف المقصورة ى إلى ياء ي", () => {
    expect(normalizeAr("مستوى")).toBe("مستوي");
  });

  it("يُحوِّل النص إلى أحرف صغيرة", () => {
    expect(normalizeAr("ABC")).toBe("abc");
  });

  it("يُزيل المسافات الزائدة من البداية والنهاية", () => {
    expect(normalizeAr("  مصروفات  ")).toBe("مصروفات");
  });

  it("يُطبِّق جميع التحويلات معاً", () => {
    expect(normalizeAr("  أَرْبَاحُ الشَّرِكَةِ  ")).toBe("ارباح الشركه");
  });

  it("يُعيد نصاً فارغاً كما هو", () => {
    expect(normalizeAr("")).toBe("");
  });
});

// ── extractLeaves ──────────────────────────────────────────────────────────────

describe("extractLeaves", () => {
  const makeCategory = (overrides: Partial<ApiCategory>): ApiCategory => ({
    id:           "1",
    nameAr:       "اختبار",
    name:         "Test",
    pnlKey:       "test_key",
    type:         "expense",
    isCalculated: false,
    children:     [],
    ...overrides,
  });

  it("يُرجع قائمة فارغة لمدخلات فارغة", () => {
    expect(extractLeaves([])).toEqual([]);
  });

  it("يُرجع الورقة (leaf) التي لا أبناء لها ولها pnlKey", () => {
    const cats = [makeCategory({ id: "1", pnlKey: "revenue.sales" })];
    const leaves = extractLeaves(cats);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].pnlKey).toBe("revenue.sales");
  });

  it("يستثني التصنيفات التي لها أبناء", () => {
    const parent = makeCategory({
      id: "p1",
      children: [makeCategory({ id: "c1" })],
    });
    expect(extractLeaves([parent])).toHaveLength(0);
  });

  it("يستثني التصنيفات ذات pnlKey فارغ أو null", () => {
    const cat = makeCategory({ pnlKey: null });
    expect(extractLeaves([cat])).toHaveLength(0);
  });

  it("يستثني التصنيفات المحسوبة (isCalculated = true)", () => {
    const cat = makeCategory({ isCalculated: true });
    expect(extractLeaves([cat])).toHaveLength(0);
  });

  it("يُرجع فقط الأوراق من مزيج متنوع", () => {
    const cats: ApiCategory[] = [
      makeCategory({ id: "1", pnlKey: "rev.sales",     children: [] }),
      makeCategory({ id: "2", pnlKey: "rev.total",     isCalculated: true }),
      makeCategory({ id: "3", pnlKey: null as unknown as string }),
      makeCategory({ id: "4", pnlKey: "exp.salaries",  children: [makeCategory({ id: "5" })] }),
      makeCategory({ id: "6", pnlKey: "exp.rent",      children: [] }),
    ];
    const leaves = extractLeaves(cats);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((l) => l.pnlKey)).toEqual(["rev.sales", "exp.rent"]);
  });

  it("يُرجع الحقول الصحيحة لكل ورقة", () => {
    const cat = makeCategory({ id: "x1", nameAr: "إيجار", name: "Rent", pnlKey: "exp.rent", type: "expense" });
    const [leaf] = extractLeaves([cat]);
    expect(leaf).toEqual({ id: "x1", nameAr: "إيجار", name: "Rent", pnlKey: "exp.rent", type: "expense" });
  });
});

// ── buildNameMap ───────────────────────────────────────────────────────────────

describe("buildNameMap", () => {
  const leaf: LeafCategory = {
    id:     "1",
    nameAr: "مصروفات التسويق",
    name:   "Marketing Expenses",
    pnlKey: "exp.marketing",
    type:   "expense",
  };

  it("يُربط الاسم العربي المُطبَّع بالـ pnlKey", () => {
    const map = buildNameMap([leaf]);
    expect(map["مصروفات التسويق"]).toBe("exp.marketing");
  });

  it("يُربط الاسم الإنجليزي بأحرف صغيرة بالـ pnlKey", () => {
    const map = buildNameMap([leaf]);
    expect(map["marketing expenses"]).toBe("exp.marketing");
  });

  it("يُربط الـ pnlKey بأحرف صغيرة بنفسه", () => {
    const map = buildNameMap([leaf]);
    expect(map["exp.marketing"]).toBe("exp.marketing");
  });

  it("يُرجع خريطة فارغة لقائمة فارغة", () => {
    expect(buildNameMap([])).toEqual({});
  });

  it("يتعامل مع أوراق متعددة", () => {
    const leaves: LeafCategory[] = [
      { id: "1", nameAr: "إيجار",    name: "Rent",    pnlKey: "exp.rent",    type: "expense" },
      { id: "2", nameAr: "مبيعات",   name: "Sales",   pnlKey: "rev.sales",   type: "revenue" },
    ];
    const map = buildNameMap(leaves);
    expect(map["ايجار"]).toBe("exp.rent"); // ة → ه تم تطبيقه، إ → ا
    expect(map["sales"]).toBe("rev.sales");
    expect(map["rev.sales"]).toBe("rev.sales");
  });
});

// ── resolveAccount ─────────────────────────────────────────────────────────────

describe("resolveAccount", () => {
  const nameMap: Record<string, string> = {
    "marketing expenses": "exp.marketing",
    "مصروفات التسويق":    "exp.marketing",
    "exp.marketing":      "exp.marketing",
    "rev.sales":          "rev.sales",
    "مبيعات":             "rev.sales",
  };

  const dbMappings: Record<string, string> = {
    "4010": "exp.rent",
    "مصروفات الإيجار": "exp.rent",
    "ايجار": "exp.rent", // نسخة مُطبَّعة
  };

  it("يُحل الحساب عبر accountKey في nameMap (أحرف صغيرة)", () => {
    expect(resolveAccount("Marketing Expenses", "", nameMap, {})).toBe("exp.marketing");
  });

  it("يُحل الحساب عبر accountNameAr المُطبَّع في nameMap", () => {
    expect(resolveAccount("", "مصروفات التسويق", nameMap, {})).toBe("exp.marketing");
  });

  it("يُحل عبر accountKey الرقمي في dbMappings", () => {
    expect(resolveAccount("4010", "", {}, dbMappings)).toBe("exp.rent");
  });

  it("يُحل عبر accountNameAr في dbMappings", () => {
    expect(resolveAccount("", "مصروفات الإيجار", {}, dbMappings)).toBe("exp.rent");
  });

  it("يُحل عبر accountNameAr المُطبَّع في dbMappings", () => {
    // "إيجار" بعد التطبيع تصبح "ايجار" (إ → ا)
    expect(resolveAccount("", "إيجار", {}, dbMappings)).toBe("exp.rent");
  });

  it("يُرجع null عند عدم العثور على تطابق", () => {
    expect(resolveAccount("9999", "حساب مجهول", {}, {})).toBeNull();
  });

  it("يُرجع null عند إدخال سلاسل فارغة", () => {
    expect(resolveAccount("", "", {}, {})).toBeNull();
  });

  it("يُعطي الأولوية لـ nameMap على dbMappings", () => {
    // نفس المفتاح موجود في الاثنين بنتائج مختلفة
    const nm = { "4010": "exp.marketing" };
    const db = { "4010": "exp.rent" };
    expect(resolveAccount("4010", "", nm, db)).toBe("exp.marketing");
  });

  it("يتجاهل المسافات الزائدة في accountKey", () => {
    expect(resolveAccount("  4010  ", "", {}, dbMappings)).toBe("exp.rent");
  });

  it("يُحل بالـ pnlKey نفسه إذا كان accountKey هو pnlKey (مفيد للملفات المُعاد رفعها)", () => {
    const nm = { "exp.marketing": "exp.marketing" };
    expect(resolveAccount("exp.marketing", "", nm, {})).toBe("exp.marketing");
  });
});

// ── COL_KEYS (خريطة أعمدة الـ Excel) ─────────────────────────────────────────

describe("COL_KEYS", () => {
  it("يتعرف على أسماء الأعمدة العربية الشائعة", () => {
    expect(COL_KEYS["اسم الشركة"]).toBe("companyName");
    expect(COL_KEYS["التاريخ"]).toBe("date");
    expect(COL_KEYS["كود الحساب"]).toBe("accountKey");
    expect(COL_KEYS["اسم الحساب"]).toBe("accountNameAr");
    expect(COL_KEYS["مدين"]).toBe("debit");
    expect(COL_KEYS["دائن"]).toBe("credit");
    expect(COL_KEYS["العملة"]).toBe("currency");
    expect(COL_KEYS["رقم القيد"]).toBe("entryNumber");
    expect(COL_KEYS["الوصف"]).toBe("description");
    expect(COL_KEYS["المرجع"]).toBe("reference");
  });

  it("يتعرف على أسماء الأعمدة الإنجليزية الشائعة", () => {
    expect(COL_KEYS["company"]).toBe("companyName");
    expect(COL_KEYS["date"]).toBe("date");
    expect(COL_KEYS["accountkey"]).toBe("accountKey");
    expect(COL_KEYS["debit"]).toBe("debit");
    expect(COL_KEYS["credit"]).toBe("credit");
    expect(COL_KEYS["currency"]).toBe("currency");
  });

  it("يتعرف على الأسماء المختصرة", () => {
    expect(COL_KEYS["الشركة"]).toBe("companyName");
    expect(COL_KEYS["كود"]).toBe("accountKey");
    expect(COL_KEYS["account"]).toBe("accountKey");
  });
});
