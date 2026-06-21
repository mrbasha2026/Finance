import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompany: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    company: { findMany: vi.fn() },
    pnLDataset: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleCompanyIds } from "@/lib/company-access";
import { GET as getCompanies } from "@/app/api/companies/route";
import { GET as getPnlBatch } from "@/app/api/pnl/save-batch/route";
import { GET as getUserCompanies, PUT as putUserCompanies } from "@/app/api/users/[id]/companies/route";
import { NextRequest } from "next/server";

// ── Sessions ───────────────────────────────────────────────────────────────────
const adminSession = {
  user: {
    id: "admin1",
    email: "admin@test.com",
    permissions: ["companies.manage", "companies.view", "pnl.view", "users.manage"],
  },
};

const managerSession = {
  user: {
    id: "manager1",
    email: "manager@test.com",
    permissions: ["companies.view", "pnl.view"],
  },
};

// ── Helper ─────────────────────────────────────────────────────────────────────
function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. getAccessibleCompanyIds helper
// ══════════════════════════════════════════════════════════════════════════════
describe("getAccessibleCompanyIds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يُعيد null للأدمن (companies.manage) — يرى الكل", async () => {
    const result = await getAccessibleCompanyIds("admin1", ["companies.manage", "companies.view"]);
    expect(result).toBeNull();
    expect(vi.mocked(prisma.userCompany.findMany)).not.toHaveBeenCalled();
  });

  it("يُعيد قائمة الشركات المخصصة لمستخدم عادي", async () => {
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([
      { companyId: "co1" },
      { companyId: "co2" },
    ] as never);

    const result = await getAccessibleCompanyIds("manager1", ["companies.view"]);

    expect(result).toEqual(["co1", "co2"]);
    expect(vi.mocked(prisma.userCompany.findMany)).toHaveBeenCalledWith({
      where: { userId: "manager1" },
      select: { companyId: true },
    });
  });

  it("يُعيد مصفوفة فارغة للمستخدم الذي لا يملك أي شركة", async () => {
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([] as never);

    const result = await getAccessibleCompanyIds("manager2", ["companies.view"]);
    expect(result).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/companies — الفلترة حسب الصلاحية
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/companies — الفلترة حسب الصلاحية", () => {
  const allCompanies = [
    { id: "co1", name: "شركة أ", _count: { pnlDatasets: 2 }, pnlDatasets: [] },
    { id: "co2", name: "شركة ب", _count: { pnlDatasets: 0 }, pnlDatasets: [] },
  ];

  beforeEach(() => vi.clearAllMocks());

  it("الأدمن يرى جميع الشركات بلا فلترة (where = undefined)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession as never);
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.company.findMany).mockResolvedValue(allCompanies as never);

    const res = await getCompanies();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.companies).toHaveLength(2);

    const findManyCall = vi.mocked(prisma.company.findMany).mock.lastCall![0];
    expect(findManyCall?.where).toBeUndefined();
  });

  it("المدير يرى فقط شركاته المخصصة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([
      { companyId: "co1" },
    ] as never);
    vi.mocked(prisma.company.findMany).mockResolvedValue([allCompanies[0]] as never);

    const res = await getCompanies();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.companies).toHaveLength(1);
    expect(json.companies[0].id).toBe("co1");

    const findManyCall = vi.mocked(prisma.company.findMany).mock.lastCall![0];
    expect(findManyCall?.where).toEqual({ id: { in: ["co1"] } });
  });

  it("المدير الذي لا يملك شركات يرى قائمة فارغة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.company.findMany).mockResolvedValue([] as never);

    const res = await getCompanies();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.companies).toHaveLength(0);

    const findManyCall = vi.mocked(prisma.company.findMany).mock.lastCall![0];
    expect(findManyCall?.where).toEqual({ id: { in: [] } });
  });

  it("يُعيد 403 إذا لم تكن لدى المستخدم صلاحية companies.view", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u3", email: "x@x.com", permissions: [] },
    } as never);

    const res = await getCompanies();
    expect(res.status).toBe(403);
  });

  it("يُعيد 401 إذا لم توجد جلسة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await getCompanies();
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. GET /api/pnl/save-batch — الفلترة حسب الصلاحية
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/pnl/save-batch — الفلترة حسب الصلاحية", () => {
  const datasets = [
    { id: "ds1", companyId: "co1", companyName: "شركة أ", period: "2024-01", company: { color: "#fff", currency: "SAR" } },
    { id: "ds2", companyId: "co2", companyName: "شركة ب", period: "2024-01", company: { color: "#000", currency: "SAR" } },
  ];

  beforeEach(() => vi.clearAllMocks());

  it("الأدمن يرى كل البيانات بلا فلتر (where = undefined)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession as never);
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.pnLDataset.findMany).mockResolvedValue(datasets as never);

    const res = await getPnlBatch();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.datasets).toHaveLength(2);

    const findManyCall = vi.mocked(prisma.pnLDataset.findMany).mock.lastCall![0];
    expect(findManyCall?.where).toBeUndefined();
  });

  it("المدير يرى فقط بيانات شركاته", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([
      { companyId: "co1" },
    ] as never);
    vi.mocked(prisma.pnLDataset.findMany).mockResolvedValue([datasets[0]] as never);

    const res = await getPnlBatch();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.datasets).toHaveLength(1);
    expect(json.datasets[0].companyId).toBe("co1");

    const findManyCall = vi.mocked(prisma.pnLDataset.findMany).mock.lastCall![0];
    expect(findManyCall?.where).toEqual({ companyId: { in: ["co1"] } });
  });

  it("يُعيد 401 إذا لم توجد جلسة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await getPnlBatch();
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. GET /api/users/[id]/companies
// ══════════════════════════════════════════════════════════════════════════════
describe("GET /api/users/[id]/companies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يُعيد الشركات المخصصة للمستخدم", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession as never);
    vi.mocked(prisma.userCompany.findMany).mockResolvedValue([
      { companyId: "co1" },
      { companyId: "co3" },
    ] as never);

    const req = makeRequest("GET", "http://localhost/api/users/manager1/companies");
    const res = await getUserCompanies(req, { params: Promise.resolve({ id: "manager1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.companyIds).toEqual(["co1", "co3"]);
  });

  it("يُعيد 403 إذا لم يكن الطالب أدمن (users.manage)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);

    const req = makeRequest("GET", "http://localhost/api/users/manager1/companies");
    const res = await getUserCompanies(req, { params: Promise.resolve({ id: "manager1" }) });

    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. PUT /api/users/[id]/companies
// ══════════════════════════════════════════════════════════════════════════════
describe("PUT /api/users/[id]/companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (ops) => {
      for (const op of ops) await op;
    });
    vi.mocked(prisma.userCompany.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.userCompany.createMany).mockResolvedValue({ count: 2 } as never);
  });

  it("يُحدّث قائمة الشركات المخصصة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession as never);

    const req = makeRequest("PUT", "http://localhost/api/users/manager1/companies", {
      companyIds: ["co1", "co2"],
    });
    const res = await putUserCompanies(req, { params: Promise.resolve({ id: "manager1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(vi.mocked(prisma.userCompany.deleteMany)).toHaveBeenCalledWith({
      where: { userId: "manager1" },
    });
  });

  it("يُزيل جميع الشركات عند إرسال مصفوفة فارغة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession as never);

    const req = makeRequest("PUT", "http://localhost/api/users/manager1/companies", {
      companyIds: [],
    });
    const res = await putUserCompanies(req, { params: Promise.resolve({ id: "manager1" }) });

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.userCompany.deleteMany)).toHaveBeenCalled();
    expect(vi.mocked(prisma.userCompany.createMany)).not.toHaveBeenCalled();
  });

  it("يُعيد 400 عند إرسال بيانات غير صحيحة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession as never);

    const req = makeRequest("PUT", "http://localhost/api/users/manager1/companies", {
      companyIds: "not-an-array",
    });
    const res = await putUserCompanies(req, { params: Promise.resolve({ id: "manager1" }) });

    expect(res.status).toBe(400);
  });

  it("يُعيد 403 للمستخدم الذي لا يملك users.manage", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);

    const req = makeRequest("PUT", "http://localhost/api/users/manager1/companies", {
      companyIds: ["co1"],
    });
    const res = await putUserCompanies(req, { params: Promise.resolve({ id: "manager1" }) });

    expect(res.status).toBe(403);
  });
});
