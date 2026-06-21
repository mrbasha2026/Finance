import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticator } from "otplib";
import qrcode from "qrcode";

// GET — generate TOTP secret + QR code for setup
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(
    session.user.email,
    "لوحة الأرباح والخسائر",
    secret
  );
  const qrDataUrl = await qrcode.toDataURL(otpauth);

  // Store secret temporarily (not activated until verified)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: secret },
  });

  return NextResponse.json({ secret, qrDataUrl });
}

// POST — verify token and enable 2FA
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, action } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: "لم يتم إعداد المفتاح السري" }, { status: 400 });
  }

  if (action === "disable") {
    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });
    if (!isValid) {
      return NextResponse.json({ error: "الرمز غير صحيح" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return NextResponse.json({ success: true });
  }

  // Verify token
  const isValid = authenticator.verify({
    token,
    secret: user.twoFactorSecret,
  });

  if (!isValid) {
    return NextResponse.json({ error: "الرمز غير صحيح" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: true },
  });

  return NextResponse.json({ success: true });
}
