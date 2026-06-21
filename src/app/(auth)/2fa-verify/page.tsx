"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { ShieldCheck, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = code.join("");
    if (token.length !== 6) { toast.error("أدخل الرمز المكوّن من 6 أرقام"); return; }

    setLoading(true);
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setLoading(false);

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json();
      toast.error(data.error ?? "رمز التحقق غير صحيح");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    }
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
        <img src="/logo-dealztree.png" alt="DealzTree" style={{ width: 220, height: 82, objectFit: "contain", display: "inline-block" }} className="mx-auto mb-8" />

        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-gray-100/80">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, var(--brand-green-deep), var(--brand-green))" }}
          >
            <ShieldCheck size={28} className="text-white" />
          </div>

          <h2 className="text-xl font-black text-gray-900 mb-1">التحقق الثنائي</h2>
          <p className="text-sm text-gray-400 mb-6">
            أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة
          </p>

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-6" dir="ltr">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all bg-gray-50"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || code.join("").length !== 6}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--brand-green-deep), var(--brand-green))",
                boxShadow: "0 4px 16px color-mix(in srgb, var(--brand-green) 35%, transparent)",
              }}
            >
              {loading ? "جارٍ التحقق..." : "تأكيد"}
            </button>
          </form>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-4 flex items-center gap-1.5 mx-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <LogOut size={12} />
          <span>العودة لتسجيل الدخول</span>
        </button>
      </motion.div>
    </div>
  );
}
