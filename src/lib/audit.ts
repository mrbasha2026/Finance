import { prisma } from "./prisma";
import { headers } from "next/headers";

export async function logAudit({
  userId,
  userEmail,
  action,
  module,
  details,
}: {
  userId?: string;
  userEmail?: string;
  action: string;
  module: string;
  details?: Record<string, unknown>;
}) {
  try {
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "unknown";

    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        action,
        module,
        details: (details ?? {}) as object,
        ipAddress: ip,
      },
    });
  } catch {
    // Audit logging failures must not break the main flow
  }
}
