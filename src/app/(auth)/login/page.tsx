"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, TrendingUp, BarChart2, PieChart, ShieldCheck } from "lucide-react";
import { LazyMotion, m } from "framer-motion";

const loadMotionFeatures = () =>
  import("framer-motion").then((res) => res.domAnimation);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const features = [
  { icon: BarChart2,  text: "تقارير P&L تفصيلية متعددة الشركات" },
  { icon: TrendingUp, text: "تحليل الأداء المالي والاتجاهات" },
  { icon: PieChart,   text: "مخططات بيانية تفاعلية متقدمة" },
  { icon: ShieldCheck,text: "نظام صلاحيات وأمان متكامل" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } else {
      // التحقق إذا كان المستخدم يحتاج 2FA
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      const user = sessionData?.user;

      if (user?.twoFactorEnabled) {
        router.push("/2fa-verify");
      } else if (user?.twoFactorForced) {
        router.push("/2fa-setup");
      } else {
        router.push("/dashboard");
      }
    }
  }

  return (
    <LazyMotion features={loadMotionFeatures}>
    <div className="min-h-screen flex bg-white" dir="rtl">

      {/* ── اللوحة الخضراء (يمين في RTL) ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(150deg, var(--brand-green-dark) 0%, var(--brand-green-deep) 45%, var(--brand-green) 100%)",
        }}
      >
        {/* نقوش هندسية */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
               style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%)" }} />
          <div className="absolute bottom-[-80px] right-[-60px] w-80 h-80 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 65%)" }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full"
               style={{ background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 65%)" }} />
          {/* خطوط شبكية خفيفة */}
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* الشعار */}
        <m.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="bg-white rounded-2xl px-8 py-5 inline-block shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-dealztree.png"
              alt="DealzTree"
              style={{ width: 240, height: 90, objectFit: "contain", display: "block" }}
            />
          </div>
        </m.div>

        {/* النص الرئيسي والمميزات */}
        <m.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 space-y-8"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              <span className="text-white/80 text-xs font-medium">نظام مالي متكامل</span>
            </div>
            <h1 className="text-4xl font-black text-white leading-tight">
              إدارة محفظة<br />
              <span className="text-green-200">شركاتك المالية</span>
            </h1>
            <p className="text-white/65 text-base leading-relaxed max-w-xs">
              منصة احترافية لتحليل بيانات الأرباح والخسائر بدقة وكفاءة عالية.
            </p>
          </div>

          <div className="space-y-3">
            {features.map(({ icon: Icon, text }, i) => (
              <m.div
                key={text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-white/12 border border-white/15 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-green-200" />
                </div>
                <span className="text-white/80 text-sm">{text}</span>
              </m.div>
            ))}
          </div>
        </m.div>

        {/* تذييل */}
        <p className="relative z-10 text-xs text-white/30">
          © {new Date().getFullYear()} DealzTree® ديلزتري. جميع الحقوق محفوظة.
        </p>
      </div>

      {/* ── لوحة النموذج ── */}
      <div className="flex-1 flex items-center justify-center p-6"
           style={{ background: "linear-gradient(160deg, #f8faf5 0%, #f2f7ee 50%, #fafaf8 100%)" }}>

        <m.div
          className="w-full max-w-[380px]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* شعار — يظهر دائماً فوق النموذج */}
          <m.div variants={itemVariants} className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-dealztree.png"
              alt="DealzTree"
              style={{ width: 220, height: 82, objectFit: "contain", display: "inline-block" }}
            />
          </m.div>

          {/* رأس النموذج */}
          <m.div variants={itemVariants} className="mb-7">
            <h2 className="text-2xl font-black text-gray-900">مرحباً بعودتك</h2>
            <p className="text-sm text-gray-400 mt-1.5">أدخل بياناتك للوصول إلى لوحة التحكم</p>
          </m.div>

          {/* البطاقة */}
          <m.div
            variants={itemVariants}
            className="bg-white rounded-2xl p-7 shadow-[0_4px_32px_rgba(0,0,0,0.08)] border border-gray-100/80"
          >
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* البريد الإلكتروني */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5 tracking-wide uppercase">
                  البريد الإلكتروني
                </label>
                <div className="relative group">
                  <Mail
                    size={15}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors pointer-events-none"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@example.com"
                    className="w-full border border-gray-200 bg-gray-50/60 rounded-xl py-3 pr-10 pl-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-primary focus:bg-white focus:ring-3 focus:ring-primary/12 transition-all duration-200"
                  />
                </div>
              </div>

              {/* كلمة المرور */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1.5 tracking-wide uppercase">
                  كلمة المرور
                </label>
                <div className="relative group">
                  <Lock
                    size={15}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-primary transition-colors pointer-events-none"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full border border-gray-200 bg-gray-50/60 rounded-xl py-3 pr-10 pl-10 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-primary focus:bg-white focus:ring-3 focus:ring-primary/12 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* زر الدخول */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full py-3 rounded-xl text-sm font-bold text-white overflow-hidden transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none mt-1"
                style={{
                  background: loading
                    ? "var(--brand-green-deep)"
                    : "linear-gradient(135deg, var(--brand-green-deep) 0%, var(--brand-green) 100%)",
                  boxShadow: "0 4px 16px color-mix(in srgb, var(--brand-green) 35%, transparent)",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="3"/>
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    جارٍ تسجيل الدخول...
                  </span>
                ) : "تسجيل الدخول"}
              </button>
            </form>
          </m.div>

          {/* شارة الأمان */}
          <m.div variants={itemVariants} className="flex items-center justify-center gap-2 mt-5">
            <ShieldCheck size={13} className="text-gray-300" />
            <p className="text-center text-xs text-gray-400">
              اتصال آمن ومشفر · © {new Date().getFullYear()} DealzTree®
            </p>
          </m.div>
        </m.div>
      </div>
    </div>
    </LazyMotion>
  );
}
