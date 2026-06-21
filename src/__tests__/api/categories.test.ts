import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock: next-auth ────────────────────────────────────────────────────────────
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// ── Mock: prisma ───────────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// ── Mock: authOptions ──────────────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/categories/route";
import { PATCH, DELETE } from "@/app/api/categories/[id]/route";
import { NextRequest } from "next/server";

// جلسة صالحة بصلاحيات كاملة
const mockSession = {
  user: {
    id: "user1",
    email: "test@test.com",
    permissions: ["expenses.categories", "pnl.view"],
  },
};

// مساعد لبناء NextRequest
function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/categories", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeRequestWithId(method: string, id: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/categories/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── GET /api/categories ────────────────────────────────────────────────────────
describe("GET /api/categories", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
  });

  it("يُعيد قائمة التصنيفات عند توفر الصلاحية", async () => {
    const mockCats = [
      { id: "1", name: "Revenue", nameAr: "الإيرادات", type: "revenue", parentId: null, pnlKey: "revenue", sortOrder: 0, isCalculated: false, isTotal: true, isSubtotal: false, children: [] },
    ];
    vi.mocked(prisma.category.findMany).mockResolvedValue(mockCats as never);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.categories).toHaveLength(1);
    expect(json.categories[0].pnlKey).toBe("revenue");
  });

  it("يُعيد 401 إذا لم توجد جلسة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });
});

// ── POST /api/categories — إضافة تصنيف جديد ──────────────────────────────────
describe("POST /api/categories — إضافة تصنيف جديد", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.category.findFirst).mockResolvedValue({ sortOrder: 10 } as never);
  });

  it("ينشئ تصنيف ورقة جديد ويُعيد pnlKey تلقائياً من الاسم الإنجليزي", async () => {
    const body = { name: "Marketing Expenses", nameAr: "مصروفات التسويق", type: "expense" };
    const created = { id: "cat_1", ...body, pnlKey: "marketing_expenses", sortOrder: 20, parentId: null, isCalculated: false, isTotal: false, isSubtotal: false };
    vi.mocked(prisma.category.create).mockResolvedValue(created as never);

    const req = makeRequest("POST", body);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.category.pnlKey).toBe("marketing_expenses");
    expect(json.category.nameAr).toBe("مصروفات التسويق");
  });

  it("ينشئ تصنيف فرعي مع parentId صحيح", async () => {
    const body = { name: "Online Marketing", nameAr: "تسويق رقمي", type: "expense", parentId: "parent_cat_1" };
    const created = { id: "cat_2", ...body, pnlKey: "online_marketing", sortOrder: 20, isCalculated: false, isTotal: false, isSubtotal: false };
    vi.mocked(prisma.category.create).mockResolvedValue(created as never);

    const req = makeRequest("POST", body);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.category.parentId).toBe("parent_cat_1");
  });

  it("يُعيد 400 إذا كان الاسم فارغاً", async () => {
    const req = makeRequest("POST", { name: "", nameAr: "اختبار", type: "expense" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("يُعيد 400 إذا كان الاسم العربي فارغاً", async () => {
    const req = makeRequest("POST", { name: "Test", nameAr: "", type: "expense" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("يُعيد 403 إذا لم يكن للمستخدم صلاحية expenses.categories", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u2", email: "x@x.com", permissions: ["pnl.view"] },
    } as never);

    const req = makeRequest("POST", { name: "Test", nameAr: "اختبار", type: "expense" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("يُولّد sortOrder بعد آخر أخ في نفس المستوى (+10)", async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValue({ sortOrder: 30 } as never);
    const created = { id: "cat_3", name: "Test", nameAr: "اختبار", type: "expense", pnlKey: "test", sortOrder: 40, parentId: null, isCalculated: false, isTotal: false, isSubtotal: false };
    vi.mocked(prisma.category.create).mockResolvedValue(created as never);

    const req = makeRequest("POST", { name: "Test", nameAr: "اختبار", type: "expense" });
    await POST(req);

    const createCall = vi.mocked(prisma.category.create).mock.lastCall![0];
    expect(createCall.data.sortOrder).toBe(40);
  });
});

// ── PATCH /api/categories/[id] — تعديل تصنيف ─────────────────────────────────
describe("PATCH /api/categories/[id] — تعديل تصنيف", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
  });

  it("يُعدّل اسم التصنيف بنجاح", async () => {
    const updated = { id: "cat_1", name: "Updated Name", nameAr: "اسم محدّث", type: "expense", pnlKey: "marketing", sortOrder: 10, parentId: null, isCalculated: false, isTotal: false, isSubtotal: false };
    vi.mocked(prisma.category.update).mockResolvedValue(updated as never);

    const req = makeRequestWithId("PATCH", "cat_1", { name: "Updated Name", nameAr: "اسم محدّث" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cat_1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.category.nameAr).toBe("اسم محدّث");
  });

  it("يُعيد 400 عند إرسال اسم إنجليزي فارغ", async () => {
    const req = makeRequestWithId("PATCH", "cat_1", { name: "" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "cat_1" }) });
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/categories/[id] — حذف تصنيف ─────────────────────────────────
describe("DELETE /api/categories/[id] — حذف تصنيف", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as never);
  });

  it("يحذف التصنيف وينقل أبناءه لأب التصنيف المحذوف", async () => {
    const cat = { id: "cat_1", parentId: "parent_1" };
    vi.mocked(prisma.category.findUnique).mockResolvedValue(cat as never);
    vi.mocked(prisma.category.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.category.delete).mockResolvedValue(cat as never);

    const req = makeRequestWithId("DELETE", "cat_1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "cat_1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // التحقق أن الأبناء انتقلوا للأب الجد
    expect(vi.mocked(prisma.category.updateMany)).toHaveBeenCalledWith({
      where: { parentId: "cat_1" },
      data: { parentId: "parent_1" },
    });
  });

  it("حذف تصنيف رئيسي: أبناؤه يصبحون بلا أب (parentId = null)", async () => {
    const cat = { id: "root_cat", parentId: null };
    vi.mocked(prisma.category.findUnique).mockResolvedValue(cat as never);
    vi.mocked(prisma.category.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.category.delete).mockResolvedValue(cat as never);

    const req = makeRequestWithId("DELETE", "root_cat");
    await DELETE(req, { params: Promise.resolve({ id: "root_cat" }) });

    expect(vi.mocked(prisma.category.updateMany)).toHaveBeenCalledWith({
      where: { parentId: "root_cat" },
      data: { parentId: null },
    });
  });
});
