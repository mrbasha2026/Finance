import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { encryptKey, decryptKey } from "@/lib/crypto";

const schema = z.object({
  zakatRate:       z.number().min(0).max(1).optional(),
  defaultCurrency: z.string().optional(),
  force2FA:        z.boolean().optional(),
  fiscalYearStart: z.number().min(1).max(12).optional(),
  aiProvider:      z.string().optional(),
  aiModel:         z.string().optional(),
  anthropicKey:    z.string().nullable().optional(),
  openaiKey:       z.string().nullable().optional(),
  googleKey:       z.string().nullable().optional(),
});

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  return "••••••••••••" + key.slice(-4);
}

function isMasked(key: string | null | undefined): boolean {
  return !!key && key.startsWith("••");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes("system.settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.systemSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) return NextResponse.json({ settings: null });

  return NextResponse.json({
    settings: {
      ...settings,
      aiApiKey:     maskKey(settings.aiApiKey     ? decryptKey(settings.aiApiKey)     : null),
      anthropicKey: maskKey(settings.anthropicKey ? decryptKey(settings.anthropicKey) : null),
      openaiKey:    maskKey(settings.openaiKey    ? decryptKey(settings.openaiKey)    : null),
      googleKey:    maskKey(settings.googleKey    ? decryptKey(settings.googleKey)    : null),
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes("system.settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صحيحة", details: parsed.error.issues }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };

  // Don't overwrite a real key if the incoming value is masked; encrypt new values
  if (isMasked(data.anthropicKey as string)) delete data.anthropicKey;
  else if (data.anthropicKey) data.anthropicKey = encryptKey(data.anthropicKey as string);
  if (isMasked(data.openaiKey as string)) delete data.openaiKey;
  else if (data.openaiKey) data.openaiKey = encryptKey(data.openaiKey as string);
  if (isMasked(data.googleKey as string)) delete data.googleKey;
  else if (data.googleKey) data.googleKey = encryptKey(data.googleKey as string);

  const settings = await prisma.systemSettings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  return NextResponse.json({
    settings: {
      ...settings,
      aiApiKey:     maskKey(settings.aiApiKey),
      anthropicKey: maskKey(settings.anthropicKey),
      openaiKey:    maskKey(settings.openaiKey),
      googleKey:    maskKey(settings.googleKey),
    },
  });
}
