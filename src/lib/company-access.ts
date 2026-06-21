import { prisma } from "./prisma";

/**
 * Returns accessible company IDs for the current user.
 * - Users with `companies.manage` → null (meaning: all companies, no filter)
 * - Others → only their explicitly assigned companies
 */
export async function getAccessibleCompanyIds(
  userId: string,
  permissions: string[]
): Promise<string[] | null> {
  if (permissions.includes("companies.manage")) return null;

  const rows = await prisma.userCompany.findMany({
    where: { userId },
    select: { companyId: true },
  });

  return rows.map((r) => r.companyId);
}
