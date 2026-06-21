import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

type PromptType = "comprehensive" | "risks" | "recommendations";

interface AnalyzeBody {
  probe?: boolean;
  companyName?: string;
  periods?: string[];
  currency?: string;
  promptType?: PromptType;
  kpis?: {
    revenue: number;
    grossProfit: number;
    grossMargin: number;
    operatingIncome: number;
    operatingMargin: number;
    netIncome: number;
    netMargin: number;
    ebitda: number;
    ebitdaMargin: number;
  };
  periodSummaries?: Array<{
    period: string;
    revenue: number;
    grossProfit: number;
    netIncome: number;
    grossMargin: number;
    operatingMargin: number;
  }>;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(body: AnalyzeBody): string {
  const { companyName, periods, currency = "SAR", promptType, kpis, periodSummaries } = body;

  const fmt = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} مليار`;
    if (abs >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)} مليون`;
    if (abs >= 1_000)         return `${(n / 1_000).toFixed(1)} ألف`;
    return n.toFixed(0);
  };

  const kpiSection = kpis ? `
## الملخص المالي (${currency})
- الإيرادات: ${fmt(kpis.revenue)} ${currency}
- إجمالي الربح: ${fmt(kpis.grossProfit)} (هامش: ${kpis.grossMargin.toFixed(1)}%)
- الدخل التشغيلي: ${fmt(kpis.operatingIncome)} (هامش: ${kpis.operatingMargin.toFixed(1)}%)
- صافي الدخل: ${fmt(kpis.netIncome)} (هامش: ${kpis.netMargin.toFixed(1)}%)
- EBITDA: ${fmt(kpis.ebitda)} (هامش: ${kpis.ebitdaMargin.toFixed(1)}%)` : "";

  const trendsSection = periodSummaries?.length ? `
## الاتجاهات الدورية
${periodSummaries.map((p) => `- ${p.period}: إيرادات ${fmt(p.revenue)} | هامش إجمالي ${p.grossMargin.toFixed(1)}% | صافي دخل ${fmt(p.netIncome)}`).join("\n")}` : "";

  const tasks: Record<PromptType, string> = {
    comprehensive: `قدّم تحليلاً مالياً شاملاً: تقييم الأداء، تحليل الهوامش، نقاط القوة والضعف، المخاطر، والتوصيات.`,
    risks:         `ركّز على المخاطر المالية: السيولة، ضغط الهامش، المؤشرات التحذيرية، وسيناريوهات المخاطر.`,
    recommendations: `قدّم توصيات استراتيجية: فرص الإيرادات، خفض التكاليف، الكفاءة التشغيلية، والأولويات.`,
  };

  return `أنت محلل مالي خبير متخصص في IFRS والبيئة المالية السعودية والخليجية.

# البيانات المالية
**الشركة:** ${companyName ?? "غير محدد"}
${periods?.length ? `الفترات: ${periods.join("، ")}` : ""}
${kpiSection}
${trendsSection}

# المهمة
${tasks[promptType ?? "comprehensive"]}

# تعليمات
- استخدم اللغة العربية الفصحى
- ادعم كل نقطة بالأرقام من البيانات
- نظّم إجابتك بعناوين واضحة
- كن مباشراً وعملياً`;
}

// ─── Provider calls ───────────────────────────────────────────────────────────

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function callGoogle(apiKey: string, model: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });
  const result = await genModel.generateContent(prompt);
  return result.response.text();
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: AnalyzeBody = await req.json();

  const sysSettings = await prisma.systemSettings.findUnique({ where: { id: "singleton" } });

  const provider = (sysSettings?.aiProvider ?? "anthropic") as string;
  const model    = sysSettings?.aiModel ?? "claude-haiku-4-5";

  // Pick the right key
  const apiKey =
    provider === "anthropic" ? (sysSettings?.anthropicKey ?? sysSettings?.aiApiKey)
    : provider === "openai"  ? sysSettings?.openaiKey
    : provider === "google"  ? sysSettings?.googleKey
    : null;

  if (!apiKey) {
    const providerNameAr = provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "Google";
    return NextResponse.json(
      { error: `لم يتم تكوين مفتاح API لـ ${providerNameAr}. يرجى إضافته في إعدادات النظام.` },
      { status: 400 }
    );
  }

  // ── Probe mode ──
  if (body.probe) {
    try {
      const probePrompt = "قل مرحبا بكلمة واحدة";
      if (provider === "anthropic") {
        const client = new Anthropic({ apiKey });
        await client.messages.create({ model, max_tokens: 10, messages: [{ role: "user", content: probePrompt }] });
      } else if (provider === "openai") {
        const client = new OpenAI({ apiKey });
        await client.chat.completions.create({ model, max_tokens: 10, messages: [{ role: "user", content: probePrompt }] });
      } else if (provider === "google") {
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model });
        await genModel.generateContent(probePrompt);
      }
      return NextResponse.json({ ok: true, provider, model });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AI probe ${provider}]`, msg);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // ── Full analysis ──
  if (!session.user?.permissions?.includes("forecasts.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const prompt = buildPrompt(body);
    let analysis = "";

    if (provider === "anthropic")      analysis = await callAnthropic(apiKey, model, prompt);
    else if (provider === "openai")    analysis = await callOpenAI(apiKey, model, prompt);
    else if (provider === "google")    analysis = await callGoogle(apiKey, model, prompt);
    else return NextResponse.json({ error: `مزود غير مدعوم: ${provider}` }, { status: 400 });

    return NextResponse.json({ analysis, model, provider });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في الاتصال بالذكاء الاصطناعي";
    console.error(`[AI analyze ${provider}]`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
