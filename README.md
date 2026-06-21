# لوحة الأرباح والخسائر — Arabic P&L Financial Dashboard

نظام إدارة مالية متكامل للشركات السعودية والإسلامية.

## الإعداد السريع

### 1. متطلبات التشغيل
- Node.js 18+
- PostgreSQL (محلي أو Supabase/Neon)

### 2. إعداد قاعدة البيانات
```bash
# انسخ ملف البيئة
cp .env.local .env.local

# عدّل DATABASE_URL في .env.local
# مثال محلي: postgresql://postgres:password@localhost:5432/fainance
```

### 3. تشغيل هجرات قاعدة البيانات
```bash
npm run db:migrate
# أو للإعداد السريع بدون هجرات:
npm run db:push
```

### 4. إدخال البيانات الأولية
```bash
npm run db:seed
```
> سيُنشئ حساب المدير: **admin@fainance.app** / **admin123**

### 5. تشغيل المشروع
```bash
npm run dev
# يعمل على http://localhost:3000
```

---

## المتغيرات البيئية المطلوبة

| المتغير | الوصف |
|---------|-------|
| `DATABASE_URL` | رابط اتصال PostgreSQL |
| `NEXTAUTH_URL` | رابط التطبيق (مثال: http://localhost:3000) |
| `NEXTAUTH_SECRET` | مفتاح سري عشوائي (32 حرف) |

---

## الوحدات المتاحة

| الوحدة | المسار | الوصف |
|--------|--------|-------|
| لوحة التحكم | `/dashboard` | نظرة عامة + مخططات |
| إدارة الشركات | `/companies` | إضافة وتعديل الشركات |
| إدخال P&L | `/pnl-entry` | إدخال يدوي + رفع Excel |
| تقارير شركة | `/pnl-reports` | تحليل مفصل لكل شركة |
| تقارير مشتركة | `/shared-reports` | مقارنة وتوحيد بيانات الشركات |
| المصروفات المقدمة | `/prepaid` | تتبع الاستهلاك الشهري |
| التصنيفات | `/categories` | إدارة الحسابات |
| المستخدمون | `/users` | إدارة الحسابات والأدوار |
| الأدوار والصلاحيات | `/roles` | مصفوفة الصلاحيات |
| سجل التدقيق | `/audit` | تتبع كل العمليات |
| إعدادات النظام | `/settings` | نسبة الزكاة، العملة، 2FA |
| الملف الشخصي | `/profile` | إعدادات المستخدم + 2FA |

---

## الأوامر المتاحة

```bash
npm run dev          # وضع التطوير
npm run build        # بناء الإنتاج
npm run start        # تشغيل الإنتاج
npm run db:push      # تطبيق الـ schema على DB
npm run db:migrate   # هجرات قاعدة البيانات
npm run db:studio    # واجهة Prisma Studio
npm run db:seed      # إدخال بيانات أولية
```
