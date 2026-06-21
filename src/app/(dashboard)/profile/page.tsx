"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { User, Lock, Shield, QrCode, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileTab = "info" | "password" | "2fa";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [activeTab, setActiveTab] = useState<ProfileTab>("info");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [qrData, setQrData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [otpToken, setOtpToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword() {
    if (!currentPwd || !newPwd) { toast.error("أدخل كلمة المرور الحالية والجديدة"); return; }
    if (newPwd !== confirmPwd) { toast.error("كلمتا المرور غير متطابقتان"); return; }
    if (newPwd.length < 8) { toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }

    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
    });
    setLoading(false);
    if (res.ok) { toast.success("تم تغيير كلمة المرور"); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }
    else { const d = await res.json(); toast.error(d.error ?? "حدث خطأ"); }
  }

  async function handleSetup2FA() {
    setLoading(true);
    const res = await fetch("/api/auth/2fa");
    const data = await res.json();
    setLoading(false);
    setQrData(data);
  }

  async function handleVerify2FA() {
    if (!otpToken) { toast.error("أدخل الرمز"); return; }
    setLoading(true);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: otpToken, action: "verify" }),
    });
    setLoading(false);
    if (res.ok) { toast.success("تم تفعيل المصادقة الثنائية"); setQrData(null); setOtpToken(""); await update(); }
    else { const d = await res.json(); toast.error(d.error ?? "رمز غير صحيح"); }
  }

  async function handleDisable2FA() {
    if (!confirm("هل أنت متأكد من تعطيل المصادقة الثنائية؟")) return;
    setLoading(true);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable" }),
    });
    setLoading(false);
    if (res.ok) { toast.success("تم تعطيل المصادقة الثنائية"); await update(); }
    else toast.error("حدث خطأ");
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <User size={22} className="text-primary" /> الملف الشخصي
      </h1>

      {/* Avatar */}
      <div className="bg-card rounded-2xl border p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {session?.user?.name?.slice(0, 2) ?? "؟"}
        </div>
        <div>
          <p className="font-bold text-lg">{session?.user?.name}</p>
          <p className="text-muted-foreground text-sm">{session?.user?.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(session?.user?.roles ?? []).join(", ")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {([
          { key: "info" as ProfileTab, label: "المعلومات", icon: User },
          { key: "password" as ProfileTab, label: "كلمة المرور", icon: Lock },
          { key: "2fa" as ProfileTab, label: "المصادقة الثنائية", icon: Shield },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {activeTab === "info" && (
        <div className="bg-card rounded-2xl border p-6 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">البريد الإلكتروني</p>
          <p className="font-medium">{session?.user?.email}</p>
          <p className="text-sm font-semibold text-muted-foreground mt-2">الأدوار</p>
          <div className="flex flex-wrap gap-2">
            {(session?.user?.roles ?? []).map((r) => (
              <span key={r} className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">{r}</span>
            ))}
          </div>
          <p className="text-sm font-semibold text-muted-foreground mt-2">الصلاحيات</p>
          <div className="flex flex-wrap gap-1">
            {(session?.user?.permissions ?? []).map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Password tab */}
      {activeTab === "password" && (
        <div className="bg-card rounded-2xl border p-6 space-y-4">
          {[
            { label: "كلمة المرور الحالية", value: currentPwd, onChange: setCurrentPwd, show: showCurrent, toggle: () => setShowCurrent((s) => !s) },
            { label: "كلمة المرور الجديدة", value: newPwd, onChange: setNewPwd, show: showNew, toggle: () => setShowNew((s) => !s) },
            { label: "تأكيد كلمة المرور", value: confirmPwd, onChange: setConfirmPwd, show: showNew, toggle: () => {} },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{f.label}</label>
              <div className="relative">
                <input
                  type={f.show ? "text" : "password"}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 pl-9"
                />
                <button type="button" onClick={f.toggle} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {f.show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={handleChangePassword}
            disabled={loading}
            className="w-full bg-primary text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}
          </button>
        </div>
      )}

      {/* 2FA tab */}
      {activeTab === "2fa" && (
        <div className="bg-card rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield size={20} className={session?.user?.twoFactorEnabled ? "text-emerald-500" : "text-muted-foreground"} />
            <div>
              <p className="font-semibold">المصادقة الثنائية TOTP</p>
              <p className="text-sm text-muted-foreground">
                {session?.user?.twoFactorEnabled ? "✅ مفعّلة" : "❌ غير مفعّلة"}
              </p>
            </div>
          </div>

          {!session?.user?.twoFactorEnabled && !qrData && (
            <button
              onClick={handleSetup2FA}
              disabled={loading}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium w-full justify-center"
            >
              <QrCode size={16} />
              {loading ? "جارٍ الإعداد..." : "إعداد المصادقة الثنائية"}
            </button>
          )}

          {qrData && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                امسح رمز QR بتطبيق Google Authenticator أو Authy
              </p>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrData.qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-xl border" />
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">أو أدخل المفتاح السري يدوياً</p>
                <code className="font-mono text-sm font-bold">{qrData.secret}</code>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1 text-right">
                  أدخل الرمز من التطبيق للتحقق
                </label>
                <input
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                  className="w-full border rounded-lg px-3 py-2 text-sm text-center font-mono tracking-widest bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <button
                onClick={handleVerify2FA}
                disabled={loading}
                className="w-full bg-emerald-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "جارٍ التحقق..." : "تفعيل المصادقة الثنائية"}
              </button>
            </div>
          )}

          {session?.user?.twoFactorEnabled && (
            <button
              onClick={handleDisable2FA}
              disabled={loading}
              className="w-full border border-red-300 text-red-600 rounded-lg py-2.5 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"
            >
              تعطيل المصادقة الثنائية
            </button>
          )}
        </div>
      )}
    </div>
  );
}
