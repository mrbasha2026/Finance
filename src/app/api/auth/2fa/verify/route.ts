import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    if (!checkRateLimit(`2fa:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: "محاولات كثيرة، يرجى الانتظار دقيقة" }, { status: 429 });
    }

    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await req.json() as { token: string };
    if (!token || token.length !== 6) {
      return NextResponse.json({ error: "رمز التحقق غير صالح" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.twoFactorSecret) {
      return NextResponse.json({ error: "المصادقة الثنائية غير مفعّلة" }, { status: 400 });
    }

    const valid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!valid) {
      return NextResponse.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("[POST /api/auth/2fa/verify]", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
