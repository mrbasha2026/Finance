"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Shield, QrCode } from "lucide-react";
import { motion } from "framer-motion";

type Step = "intro" | "scan" | "verify";

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { update } = useSession();
  const [step, setStep] = useState<Step>("intro");
  const [qrData, setQrData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    const res = await fetch("/api/auth/2fa");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error("حدث خطأ في إنشاء رمز QR"); return; }
    setQrData(data);
    setStep("scan");
  }

  async function handleVerify() {
    if (otp.length !== 6) { toast.error("أدخل الرمز المكوّن من 6 أرقام"); return; }
    setLoading(true);
    const res = await fetch("/api/auth/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: otp, action: "verify" }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "رمز غير صحيح");
      return;
    }
    await update();
    router.push("/2fa-verify");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, #f8faf5 0%, #f2f7ee 50%, #fafaf8 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm text-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dealztree.png"
          alt="DealzTree"
          style={{ width: 220, height: 82, objectFit: "contain", display: "inline-block" }}
          className="mx-auto mb-8"
        />

        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-gray-100/80">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, var(--brand-green-deep), var(--brand-green))" }}
          >
            <Shield size={28} className="text-white" />
          </div>

          <h2 className="text-xl font-black text-gray-900 mb-1">إعداد المصادقة الثنائية</h2>
          <p className="text-sm text-gray-400 mb-6">
            يتطلب النظام تفعيل المصادقة الثنائية لحماية حسابك
          </p>

          {step === "intro" && (
            <div className="space-y-4">
              <div className="text-right text-sm text-gray-600 space-y-2 bg-gray-50 rounded-xl p-4">
                <p>١. ثبّت تطبيق <strong>Google Authenticator</strong> أو <strong>Authy</strong></p>
                <p>٢. امسح رمز QR الذي سيظهر لك</p>
                <p>٣. أدخل الرمز المكوّن من 6 أرقام للتأكيد</p>
              </div>
              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--brand-green-deep), var(--brand-green))" }}
              >
                <QrCode size={16} />
                {loading ? "جارٍ الإعداد..." : "ابدأ الإعداد"}
              </button>
            </div>
          )}

          {step === "scan" && qrData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrData.qrDataUrl} alt="QR Code" className="w-44 h-44 rounded-xl border" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">أو أدخل المفتاح يدوياً</p>
                <code className="font-mono text-sm font-bold text-gray-700 break-all">{qrData.secret}</code>
              </div>
              <button
                onClick={() => setStep("verify")}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, var(--brand-green-deep), var(--brand-green))" }}
              >
                تم المسح ← التالي
              </button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">أدخل الرمز من تطبيق المصادقة للتأكيد</p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                placeholder="000000"
                className="w-full border-2 border-gray-200 rounded-xl py-3 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-primary transition-colors"
                dir="ltr"
                autoFocus
              />
              <button
                onClick={handleVerify}
                disabled={loading || otp.length !== 6}
                className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--brand-green-deep), var(--brand-green))" }}
              >
                {loading ? "جارٍ التحقق..." : "تفعيل المصادقة الثنائية"}
              </button>
              <button
                onClick={() => setStep("scan")}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← رجوع
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
