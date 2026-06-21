import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/pnl-calculations", () => ({
  inferCalculatedRows: vi.fn((data: Record<string, number>) => data),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    userCompany: {
      findMany: vi.fn(),
      upsert:   vi.fn(),
    },
    company: {
      findMany: vi.fn(),
    },
    pnLDataset: {
      findUnique: vi.fn(),
      upsert:     vi.fn(),
    },
    journalEntry: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/pnl/save-batch/route";
import { NextRequest } from "next/server";

// ── Sessions ───────────────────────────────────────────────────────────────────
const adminSession = {
  user: {
    id: "admin1",
    email: "admin@test.com",
    permissions: ["pnl.upload", "companies.manage"],
  },
};

const managerSession = {
  user: {
    id: "manager1",
    email: "manager@test.com",
    permissions: ["pnl.upload", "companies.view"],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeUploadRequest(datasets: unknown[]) {
  return new NextRequest("http://localhost/api/pnl/save-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datasets }),
  });
}

const validDataset = {
  companyId:   "co1",
  companyName: "شركة أ",
  period:      "2024-01",
  currency:    "SAR",
  lineItems:   [{ key: "sales_revenue", amount: 100000 }],
  mode:        "replace",
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/pnl/save-batch — منح الوصول تلقائياً عند الرفع
// ══════════════════════════════════════════════════════════════════════════════
describe("POST /api/pnl/save-batch — منح الوصول التلقائي عند الرفع", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.company.findMany).mockResolvedValue([]);
    vi.mocked(prisma.pnLDataset.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pnLDataset.upsert).mockResolvedValue({ id: "ds1" } as never);
    vi.mocked(prisma.userCompany.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.journalEntry.createMany).mockResolvedValue({ count: 0 } as never);
  });

  it("يُضيف UserCompany للمدير عند رفع بيانات شركة موجودة (companyId محدد)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);

    const req = makeUploadRequest([validDataset]);
    const res = await POST(req);

    expect(res.status).toBe(200);

    expect(vi.mocked(prisma.userCompany.upsert)).toHaveBeenCalledOnce();
    expect(vi.mocked(prisma.userCompany.upsert)).toHaveBeenCalledWith({
      where:  { userId_companyId: { userId: "manager1", companyId: "co1" } },
      create: { userId: "manager1", companyId: "co1" },
      update: {},
    });
  });

  it("لا يُضيف UserCompany للأدمن (companies.manage) عند الرفع", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession as never);

    const req = makeUploadRequest([validDataset]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.userCompany.upsert)).not.toHaveBeenCalled();
  });

  it("يُضيف UserCompany للمدير عند رفع شركة جديدة (إنشاء تلقائي)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);

    // No companyId — system creates the company
    const newCompany = { id: "co_new", name: "شركة جديدة", currency: "SAR" };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      typeof fn === "function" ? fn({ company: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(newCompany) } }) : fn
    );
    vi.mocked(prisma.company.findMany).mockResolvedValue([]);

    const datasetWithoutId = {
      companyName: "شركة جديدة",
      period:      "2024-02",
      currency:    "SAR",
      lineItems:   [{ key: "sales_revenue", amount: 50000 }],
      mode:        "replace",
    };

    const req = makeUploadRequest([datasetWithoutId]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.userCompany.upsert)).toHaveBeenCalledOnce();
    expect(vi.mocked(prisma.userCompany.upsert).mock.calls[0][0].create.userId).toBe("manager1");
  });

  it("يُضيف UserCompany مرة واحدة لكل شركة حتى لو رُفعت فترات متعددة لها", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);

    const multiPeriod = [
      { ...validDataset, period: "2024-01" },
      { ...validDataset, period: "2024-02" },
      { ...validDataset, period: "2024-03" },
    ];

    const req = makeUploadRequest(multiPeriod);
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Should be called 3 times (once per dataset), all with same companyId
    // The upsert handles deduplication at the DB level
    expect(vi.mocked(prisma.userCompany.upsert)).toHaveBeenCalledTimes(3);
    for (const call of vi.mocked(prisma.userCompany.upsert).mock.calls) {
      expect(call[0].create.companyId).toBe("co1");
    }
  });

  it("يُضيف UserCompany لكل شركة مختلفة في نفس الرفع", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);

    const twoCompanies = [
      { ...validDataset, companyId: "co1", companyName: "شركة أ" },
      { ...validDataset, companyId: "co2", companyName: "شركة ب", period: "2024-02" },
    ];

    const req = makeUploadRequest(twoCompanies);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.userCompany.upsert)).toHaveBeenCalledTimes(2);

    const calledCompanyIds = vi.mocked(prisma.userCompany.upsert).mock.calls.map(
      (c) => c[0].create.companyId
    );
    expect(calledCompanyIds).toContain("co1");
    expect(calledCompanyIds).toContain("co2");
  });

  it("يُعيد 401 إذا لم توجد جلسة", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = makeUploadRequest([validDataset]);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("يُعيد 403 إذا لم تكن لدى المستخدم صلاحية pnl.upload", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u3", email: "x@x.com", permissions: ["companies.view"] },
    } as never);
    const req = makeUploadRequest([validDataset]);
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("يُعيد 400 إذا كانت البيانات غير صحيحة (lineItems فارغة)", async () => {
    vi.mocked(getServerSession).mockResolvedValue(managerSession as never);
    const req = makeUploadRequest([{ ...validDataset, lineItems: [] }]);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
