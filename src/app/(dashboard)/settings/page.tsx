"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings, Save, Eye, EyeOff, CheckCircle2, Loader2, Sparkles } from "lucide-react";

// ─── Provider config ──────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id:          "anthropic",
    name:        "Anthropic — Claude",
    nameAr:      "أنثروبيك",
    keyField:    "anthropicKey" as const,
    placeholder: "sk-ant-api03-...",
    docsUrl:     "console.anthropic.com",
    color:       "#d97706",
    models: [
      { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  note: "الأرخص ($1/م)" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "جودة أعلى ($3/م)" },
      { id: "claude-opus-4-8",   label: "Claude Opus 4.8",   note: "أعلى دقة ($5/م)" },
    ],
  },
  {
    id:          "openai",
    name:        "OpenAI — GPT",
    nameAr:      "أوبن إيه آي",
    keyField:    "openaiKey" as const,
    placeholder: "sk-proj-...",
    docsUrl:     "platform.openai.com/api-keys",
    color:       "#10a37f",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini", note: "الأرخص ($0.15/م)" },
      { id: "gpt-4o",      label: "GPT-4o",      note: "جودة عالية ($2.5/م)" },
    ],
  },
  {
    id:          "google",
    name:        "Google — Gemini",
    nameAr:      "جوجل",
    keyField:    "googleKey" as const,
    placeholder: "AIzaSy...",
    docsUrl:     "aistudio.google.com/app/apikey",
    color:       "#4285f4",
    models: [
      { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash", note: "مجاني! سريع جداً", free: true },
      { id: "gemini-1.5-flash",     label: "Gemini 1.5 Flash", note: "مجاني! (1500 طلب/يوم)", free: true },
      { id: "gemini-1.5-pro",       label: "Gemini 1.5 Pro",   note: "جودة عالية ($3.5/م)", free: false },
    ],
  },
] as const;

type ProviderId = typeof PROVIDERS[number]["id"];
type KeyField = typeof PROVIDERS[number]["keyField"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemSettings {
  zakatRate:       number;
  defaultCurrency: string;
  force2FA:        boolean;
  fiscalYearStart: number;
  aiProvider:      ProviderId;
  aiModel:         string;
  anthropicKey:    string | null;
  openaiKey:       string | null;
  googleKey:       string | null;
}

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const DEFAULT_SETTINGS: SystemSettings = {
  zakatRate: 0.025, defaultCurrency: "SAR", force2FA: false, fiscalYearStart: 1,
  aiProvider: "anthropic", aiModel: "claude-haiku-4-5",
  anthropicKey: null, openaiKey: null, googleKey: null,
};

// ─── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  isActive,
  apiKey,
  model,
  onActivate,
  onKeyChange,
  onModelChange,
}: {
  provider: typeof PROVIDERS[number];
  isActive: boolean;
  apiKey: string | null;
  model: string;
  onActivate: () => void;
  onKeyChange: (v: string | null) => void;
  onModelChange: (v: string) => void;
}) {
  const [showKey, setShowKey]       = useState(false);
  const [testing, setTesting]       = useState(false);
  const [testOk, setTestOk]         = useState<boolean | null>(null);
  const [testError, setTestError]   = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestOk(null);
    setTestError(null);

    // Save this provider's key first
    const saveRes = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [provider.keyField]: apiKey, aiProvider: provider.id, aiModel: model }),
    });
    if (!saveRes.ok) {
      const d = await saveRes.json().catch(() => ({}));
      setTesting(false); setTestOk(false);
      setTestError(`فشل الحفظ: ${d.error ?? saveRes.status}`);
      return;
    }

    const res  = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ probe: true }),
    });
    const data = await res.json().catch(() => ({}));
    setTesting(false);
    setTestOk(res.ok);
    setTestError(res.ok ? null : (data.error ?? "خطأ غير معروف"));
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${isActive ? "border-primary bg-primary/5" : "border-border"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: provider.color }}>
            {provider.nameAr.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">{provider.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{provider.nameAr}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onActivate}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            isActive
              ? "bg-primary text-white"
              : "border hover:bg-accent"
          }`}
        >
          {isActive ? "✓ نشط" : "تفعيل"}
        </button>
      </div>

      {/* Model selector */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1.5">النموذج</label>
        <div className="space-y-1.5">
          {provider.models.map((m) => (
            <label key={m.id} className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer text-xs transition-colors ${model === m.id && isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
              <input type="radio" name={`model-${provider.id}`} checked={isActive && model === m.id}
                onChange={() => { onActivate(); onModelChange(m.id); }}
                className="accent-primary shrink-0"
              />
              <span className="font-medium flex-1">{m.label}</span>
              <span className="text-muted-foreground">{m.note}</span>
              {"free" in m && m.free && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] font-bold">
                  مجاني
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1.5">مفتاح API</label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            placeholder={provider.placeholder}
            value={apiKey ?? ""}
            onChange={(e) => { onKeyChange(e.target.value || null); setTestOk(null); setTestError(null); }}
            className="w-full border rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 pe-9 font-mono"
          />
          <button type="button" onClick={() => setShowKey((v) => !v)}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          احصل على مفتاحك من <span className="font-mono text-primary">{provider.docsUrl}</span>
        </p>
      </div>

      {/* Test */}
      <div className="space-y-1.5">
        <button type="button" onClick={handleTest} disabled={testing || !apiKey}
          className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-accent disabled:opacity-40 transition-colors w-full justify-center">
          {testing ? <><Loader2 size={12} className="animate-spin" /> جارٍ الاختبار...</> : "اختبار الاتصال"}
        </button>
        {testOk === true && (
          <p className="flex items-center gap-1 text-xs text-emerald-600 font-medium justify-center">
            <CheckCircle2 size={12} /> الاتصال ناجح
          </p>
        )}
        {testError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-[10px] text-destructive font-mono break-all">
            {testError}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings((prev) => ({ ...prev, ...d.settings }));
        setLoading(false);
      });
  }, []);

  function setKey(field: KeyField, value: string | null) {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) toast.success("تم حفظ الإعدادات");
    else toast.error("حدث خطأ أثناء الحفظ");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">جارٍ تحميل الإعدادات...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings size={22} className="text-primary" /> إعدادات النظام
      </h1>

      <div className="bg-card rounded-2xl border p-6 space-y-6">

        {/* Zakat Rate */}
        <div>
          <label className="text-sm font-semibold block mb-1">نسبة الزكاة</label>
          <p className="text-xs text-muted-foreground mb-3">النسبة الافتراضية لحساب الزكاة (الافتراضي: 2.5%)</p>
          <div className="flex items-center gap-3">
            <input type="number" min="0" max="1" step="0.001" value={settings.zakatRate}
              onChange={(e) => setSettings({ ...settings, zakatRate: parseFloat(e.target.value) || 0 })}
              className="w-32 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-sm text-muted-foreground">= {(settings.zakatRate * 100).toFixed(2)}%</span>
          </div>
        </div>

        <hr className="border-border" />

        {/* Default Currency */}
        <div>
          <label className="text-sm font-semibold block mb-1">العملة الافتراضية</label>
          <p className="text-xs text-muted-foreground mb-3">العملة المستخدمة افتراضياً في جميع التقارير</p>
          <select value={settings.defaultCurrency}
            onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
            className="w-48 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
            {["SAR","USD","EUR","AED","KWD","BHD","OMR","QAR"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <hr className="border-border" />

        {/* Fiscal Year Start */}
        <div>
          <label className="text-sm font-semibold block mb-1">بداية السنة المالية</label>
          <p className="text-xs text-muted-foreground mb-3">الشهر الذي تبدأ فيه السنة المالية للشركات</p>
          <select value={settings.fiscalYearStart}
            onChange={(e) => setSettings({ ...settings, fiscalYearStart: parseInt(e.target.value) })}
            className="w-48 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40">
            {MONTHS_AR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>

        <hr className="border-border" />

        {/* Force 2FA */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-semibold block">إجبار المصادقة الثنائية</label>
            <p className="text-xs text-muted-foreground mt-0.5">إلزام جميع المستخدمين بتفعيل المصادقة الثنائية TOTP</p>
          </div>
          <button type="button" role="switch" aria-checked={settings.force2FA}
            onClick={() => setSettings({ ...settings, force2FA: !settings.force2FA })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${settings.force2FA ? "bg-primary" : "bg-muted"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.force2FA ? "translate-x-1" : "translate-x-6"}`} />
          </button>
        </div>

        <hr className="border-border" />

        {/* AI Providers */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-primary" />
            <label className="text-sm font-semibold">نماذج الذكاء الاصطناعي</label>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            فعّل مزوداً واحداً أو أكثر — المزود النشط يُستخدم في التحليل الذكي.
            مفاتيح API تُخزَّن بشكل آمن في قاعدة البيانات.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {PROVIDERS.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isActive={settings.aiProvider === provider.id}
                apiKey={settings[provider.keyField]}
                model={settings.aiProvider === provider.id ? settings.aiModel : (provider.models[0]?.id ?? "")}
                onActivate={() => setSettings((prev) => ({
                  ...prev,
                  aiProvider: provider.id,
                  aiModel: prev.aiProvider === provider.id ? prev.aiModel : provider.models[0].id,
                }))}
                onKeyChange={(v) => setKey(provider.keyField, v)}
                onModelChange={(m) => setSettings((prev) => ({ ...prev, aiModel: m }))}
              />
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
            <Save size={15} />
            {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </button>
        </div>
      </div>
    </div>
  );
}
