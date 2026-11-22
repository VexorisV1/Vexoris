cd /workspaces/Vexoris
git status > /tmp/current_state.txt
git log --oneline -n 10 > /tmp/recent_commits.txt
ls -la web/src/core/ web/src/hooks/ web/src/shared/lib/ > /tmp/new_files.txt

git ls-files | grep -vE 'lock|\.(png|jpe?g|gif|svg|ico|webp|woff2?|ttf|mp4|pdf)$' > /tmp/files.txt
{
  echo "## FILE TREE"; cat /tmp/files.txt; echo
  while read -r f; do
    echo "=== $f ==="; head -c 6000 "$f"; echo
  done < /tmp/files.txt
} > project-summary.txt
ند

1. نظرة عامة على النظام
2. رحلة التطور (من Vanilla → React)
3. الستاك التقني الحالي
4. البنية المعمارية (Architecture)
5. قاعدة البيانات (Schema + Migration)
6. نظام المصادقة (Authentication)
7. إدارة الجلسات (Session Management)
8. الأدوار والصلاحيات (RBAC)
9. الملفات والمجلدات (كل ملف ووظيفته)
10. نظام التصميم (Aurora Sky)
11. النشر (Cloudflare)
12. الـ RPCs المتاحة
13. الصفحات — الوضع الحالي
14. الأخطاء المعروفة والمشاكل التقنية
15. البيئة والمفاتيح
16. الدروس المستفادة من الترحيل
17. الخطوات القادمة (Roadmap)

---

## 1️⃣ نظرة عامة على النظام

### الاسم والهوية
- **الاسم الرسمي:** VEXORIS — Medical Record & Auditing System
- **اللغة:** عربي (RTL) بالكامل
- **الجمهور:** إدارة السجلات الطبية + مراجعي الجودة + المديرين الطبيين
- **الشعار النصي:** "Medical Record & Auditing System"
- **الcredits (في الفوتر):** أ/ نادية عادل — أ/ خالد شوقي

### الغرض الوظيفي
1. **تسجيل وحدات التدقيق الطبي:** كل ملف طبي يتم تقييمه على عدة معايير (نماذج، خدمات، أخطاء)
2. **مراجعة الجودة:** حساب نسبة الجودة لكل مراجع/قسم/طبيب/نموذج
3. **التقارير التحليلية:** مقارنات شهرية، اتجاهات، KPIs
4. **سجل تدقيق أمني:** تتبع كل حركة في النظام (من دخل، عدّل، حذف)
5. **إدارة الصلاحيات:** 8 أدوار مختلفة مع صلاحيات مفصلة

### الأدوار الثمانية (ROLE_META)
| الدور | التسمية العربية | اللون | الأيقونة |
|---|---|---|---|
| `super_admin` | المطور | `#8b5cf6` | shield-check |
| `admin` | إدارة السجلات | `#0ea5e9` | settings |
| `manager` | المدير الطبي | `#06b6d4` | briefcase-medical |
| `auditor` | مراجع جودة | `#10b981` | clipboard-check |
| `senior` | رئيس قسم | `#f59e0b` | user-cog |
| `doctor` | طبيب | `#6366f1` | stethoscope |
| `reviewer_doctor` | طبيب مراجع | `#a855f7` | user-round-check |
| `viewer` | مراجع | `#64748b` | eye |

---

## 2️⃣ رحلة التطور (من Vanilla → React)

### المرحلة أ: النظام القديم (V8 → V9)
**الستاك:** HTML/CSS/JS خام + Tailwind CDN + ApexCharts + jsPDF + SheetJS
**البنية:** 20+ صفحة HTML منفصلة، كل صفحة فيها header مكرر + منطق auth مكرر
**المشكلة الأساسية:** تكرار ضخم في الكود + صعوبة الصيانة

### المرحلة ب: قرار الترحيل
- **السبب:** "عاوز أنقل النظام ده بكامل المنطق بكامل قاعدة البيانات بتاعتها لبيئة عمل نهائية"
- **القرار:** React + Vite + TypeScript (frontend-only migration)
- **مبدأ:** Supabase schema + RPCs + RLS تبقى **كما هي** بدون تغيير

### المرحلة ج: إنشاء البيئة الجديدة
- **GitHub Codespaces** كبيئة تطوير
- **Vite 6** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (install مش CDN)
- **shadcn/ui pattern** (لكن بدون shadcn رسمي — مكونات مخصصة)
- **TanStack Query v5** للـ server state
- **React Router v7** للـ routing
- **framer-motion** للأنيميشن
- **lucide-react** للأيقونات

### المرحلة د: ترحيل قاعدة البيانات (22 نوفمبر 2025)
- **المصدر:** Supabase project `omezrsyjsxdeaautmsad` (eu-west-1)
- **الهدف:** Supabase project `iobrgmqbxqoquedegnpp` (eu-west-1)
- **الأداة:** `pg_dump` 17 + `psql`
- **النتيجة:** ✅ نجاح كامل (كل الجداول + الدوال + البيانات)

### المرحلة هـ: النشر الأولي
- **Cloudflare Pages** مع auto-deploy من GitHub `main`
- **Custom domain:** (يتم تحديده حسب إعداداتك)
- **Build:** `cd web && npm run build` → output `web/dist`

---

## 3️⃣ الستاك التقني الحالي

### Frontend Core
```json
{
  "framework": "React 19 + TypeScript",
  "bundler": "Vite 6",
  "routing": "React Router v7",
  "styling": "Tailwind CSS v4",
  "state": {
    "server": "TanStack Query v5",
    "client": "React Context (AuthProvider)",
    "forms": "Native React state (فيه react-hook-form مثبت لكن مش مستخدم بكثافة)"
  },
  "http": "@supabase/supabase-js v2.45+",
  "animation": "framer-motion",
  "icons": "lucide-react",
  "charts": "recharts",
  "fonts": "Tajawal (Google Fonts) + Space Grotesk"
}
```

### Backend (Supabase)
- **PostgreSQL 17** (server version 17.11)
- **Auth:** email/password + TOTP MFA
- **RLS:** مفعّل على 10+ جدول
- **Realtime:** مفعّل (لكن مش مستخدم بشكل مكثف حاليًا)
- **RPCs:** 48 دالة PostgreSQL
- **Storage:** لا buckets مخصصة بعد

### DevOps
- **GitHub:** `VexorisV1/Vexoris`
- **Cloudflare Pages:** auto-deploy من `main`
- **Env vars:** في Cloudflare Dashboard (Production)

---

## 4️⃣ البنية المعمارية

### المستويات (Layers)
```
┌─────────────────────────────────────────┐
│  Pages (modules/*)                       │  ← UI
├─────────────────────────────────────────┤
│  Hooks (hooks/*)                         │  ← Server state logic
├─────────────────────────────────────────┤
│  RPC Layer (core/rpc.ts)                 │  ← Typed Supabase wrapper
├─────────────────────────────────────────┤
│  Supabase Client (core/supabase.ts)      │  ← Connection
├─────────────────────────────────────────┤
│  PostgreSQL + RLS (Supabase)             │  ← Data
└─────────────────────────────────────────┘
```

### تدفق المصادقة
```
Login Page
   ↓ email + password
supabase.auth.signInWithPassword()
   ↓
MFA check (if verified factor)
   ↓ → /auth/mfa
MFA Verify Page
   ↓ TOTP code
supabase.auth.mfa.verify()
   ↓
Profile check (password_changed, mfa_setup_done)
   ↓ → /auth/setup-account OR /auth/mfa-setup
AuthCallback (handles PKCE)
   ↓
/dashboard (with ProtectedRoute)
```

### تدفق الـ ProtectedRoute
```
ProtectedRoute
   ↓ loading? → FullPageLoading
   ↓ no user? → Navigate to /login
   ↓ role not allowed? → Navigate to /dashboard
   ↓ else → <Outlet />
```

---

## 5️⃣ قاعدة البيانات

### المشروعان

| | القديم | الجديد |
|---|---|---|
| **Reference** | `omezrsyjsxdeaautmsad` | `iobrgmqbxqoquedegnpp` |
| **Region** | eu-west-1 | eu-west-1 |
| **الغرض** | المصدر | الهدف النهائي |
| **الحالة** | مصدر (احتياطي) | **production** |

### الجداول (37 في public)

```
📋 catalogs (قوائم)
├── admission_type_catalog
├── case_status_catalog
├── daycase_catalog
├── department_aliases
├── departments
├── form_catalog
├── issue_catalog
├── issue_category_catalog
├── role_catalog
├── role_permissions
├── score_catalog
├── service_catalog
├── specialty_catalog
└── apps

🩺 staff (كيان الموظفين)
├── doctors
├── nurses
└── ward_clerks

📊 medical data
├── medical_file_reviews (2960 سجل)
├── medical_file_reviews_backup
├── audit_records
├── audit_units_flat (144,457 وحدة)
├── audit_error_logs
├── work_records (750 سجل)
├── work_evaluations
├── work_file_tracking
└── work_staff

🔐 auth & security
├── profiles (22 مستخدم)
├── user_sessions
├── trusted_devices
└── audit_log (94 سجل)

🔗 mappings
├── app_catalog_map
├── form_daycase_map
├── form_exclusion_map
├── form_service_map
├── form_specialty_map
├── file_specialties
└── v_file_quality (view)
```

### الدوال (48 function)
**مصنفة حسب الغرض:**

```sql
-- Sessions (7)
create_session, validate_session, end_session, get_my_sessions,
get_active_sessions, kill_session, use_grace, cleanup_old_sessions

-- Quality (11)
get_quality_kpis, get_quality_compare, get_quality_reviewers,
get_quality_reviewer_details, get_quality_specialties,
get_quality_errors, get_quality_daily, get_quality_all_specialties,
get_quality_trend, get_quality_reviewer_details

-- Statistics (10)
get_overview_stats, get_monthly_trend, get_departments_stats,
get_doctors_stats, get_nurses_stats, get_clerks_stats,
get_forms_stats, get_item_details, get_comparison, _enrich_metrics

-- Utilities (5)
normalize_arabic, normalize_arabic_name, clean_reviewer_name,
translate_issue_code, is_ambiguous_name

-- Auth/Roles (4)
is_admin, is_catalog_admin, log_audit_event, rls_auto_enable

-- Sync (4)
sync_audit_units, sync_doctor_dept, sync_file_specialty,
audit_user_update, update_form_updated_at, update_review_updated_at

-- Work (2)
save_work_batch, shift_form_order

-- Labels (1)
get_all_issue_labels
```

### RLS Policies
**أمثلة من السياسات الحالية:**
- `profiles`: "Public profiles are viewable by everyone" + "Users can update own profile"
- `audit_log`: "Admins can read audit log" + "audit_log_delete_by_admin"
- `medical_file_reviews`: "authenticated_all_access" + "authenticated_select_reviews"
- `trusted_devices`: "Users can see their own devices"

**⚠️ تحذير:** سياسة "Public profiles are viewable by everyone" مش مثالية للأمان — المفروض تكون `authenticated` فقط. (deferred issue)

### Triggers (5)
- `trg_form_updated_at` → يحدّث `updated_at` تلقائيًا
- `trg_reviews_updated_at` → نفسه لـ reviews
- `trg_shift_form_order` → إعادة ترتيب النماذج
- `trg_sync_audit_units` → يزامن `audit_units_flat` مع `medical_file_reviews`
- `trg_sync_doctor_dept` → يزامن `department_normalized`

### Indexes (104)
**الأهم للأداء:**
- `idx_audit_log_action`, `idx_audit_log_created`, `idx_audit_log_severity`, `idx_audit_log_user`
- `idx_mfr_app_id`, `idx_mfr_discharge_reviewer`, `idx_mfr_reviewer_clean`, `idx_mfr_reviewed_at`
- `idx_auf_*` (5 indexes على audit_units_flat)
- `idx_user_sessions_*` (3 indexes للـ sessions)

### Sequences (تم إصلاحها بعد الترحيل)
كل الـ `*_id_seq` اتعمل لها `setval` بناءً على `MAX(id)` — يعني الـ INSERT الجديد هيكمل من حيث انتهى.

**مثال:**
```sql
audit_log_id_seq.last_value = 203 (= max(id))
→ INSERT التالي هيبدأ من 204
```

---

## 6️⃣ نظام المصادقة

### الملفات الأساسية
| الملف | الوظيفة |
|---|---|
| `web/src/core/supabase.ts` | إنشاء Supabase client |
| `web/src/core/auth.tsx` | AuthProvider + useAuth hook |
| `web/src/modules/auth/ProtectedRoute.tsx` | Route guard |
| `web/src/modules/auth/LoginPage.tsx` | صفحة الدخول |
| `web/src/modules/auth/AuthCallbackPage.tsx` | OAuth/PKCE callback |
| `web/src/modules/auth/SetupAccountPage.tsx` | تعيين كلمة المرور الأولى |
| `web/src/modules/auth/MfaSetupPage.tsx` | إعداد TOTP |
| `web/src/modules/auth/MfaVerifyPage.tsx` | إدخال TOTP |
| `web/src/modules/auth/ChangePasswordPage.tsx` | تغيير كلمة المرور |
| `web/src/modules/auth/SessionsPage.tsx` | الجلسات النشطة |

### تدفق الدخول الكامل

#### حالة 1: مستخدم جديد (لم يسجل من قبل)
```
/login → email + password
  ↓
supabase.auth.signInWithPassword()
  ↓
MFA factors check → None
  ↓
profiles.password_changed = false
  ↓ → /auth/setup-account
SetupAccountPage
  ↓ كلمة مرور جديدة
supabase.auth.updateUser({ password })
profiles.update({ password_changed: true })
  ↓ → /auth/mfa-setup
MfaSetupPage
  ↓ عرض QR code
supabase.auth.mfa.enroll({ factorType: 'totp' })
  ↓ إدخال 6 أرقام
supabase.auth.mfa.challenge() + verify()
profiles.update({ mfa_setup_done: true })
  ↓ → /dashboard
```

#### حالة 2: مستخدم قديم مع MFA
```
/login → email + password
  ↓
MFA factor exists (verified)
  ↓ → /auth/mfa
MfaVerifyPage → 6 أرقام
  ↓
supabase.auth.mfa.challenge() + verify()
  ↓ → /dashboard
```

#### حالة 3: مستخدم قديم بدون MFA
```
/login → email + password
  ↓
MFA factor none
profiles.password_changed = true
profiles.mfa_setup_done = true
  ↓ → /dashboard مباشرة
```

### AuthProvider — التخزين
```tsx
{
  session: Session | null,
  user: User | null,
  profile: Profile | null,   // ← loaded from profiles table
  loading: boolean,
  signOut: () => Promise<void>,
  refreshProfile: () => Promise<void>,   // ← لإعادة التحميل بعد التعديل
}
```

### Profile type
```tsx
type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  department: string | null;
  password_changed: boolean;
  mfa_setup_done: boolean;
};
```

### Supabase Client config
```ts
createClient(url, key, {
  auth: {
    persistSession: true,        // session في localStorage
    autoRefreshToken: true,      // تجديد تلقائي
    detectSessionInUrl: true,    // للـ OAuth callbacks
    flowType: 'pkce',            // الأكثر أمانًا
  }
})
```

---

## 7️⃣ إدارة الجلسات

### الحالة الحالية
- **الأمان على مستوى قاعدة البيانات:** `user_sessions` + `trusted_devices` موجودين
- **الحماية في التطبيق:** `session-guard.js` القديم **لم يُنقل بعد** لـ React
- **الحماية الفعلية:** Supabase Auth JWT (افتراضيًا ساعة)

### RPCs متاحة
```sql
create_session(p_device_id, p_device_info, p_duration_hours, p_user_agent, p_ip)
validate_session(p_session_token)
end_session(p_session_token, p_reason)
get_my_sessions()
get_active_sessions()
kill_session(p_session_id)
use_grace(p_session_token)
cleanup_old_sessions()  -- cron
```

### Session Schema
```sql
user_sessions:
  id UUID PK
  user_id UUID FK → auth.users
  session_token TEXT UNIQUE
  device_id TEXT
  device_info JSONB  -- { os, browser, screen, ... }
  user_agent TEXT
  ip_address TEXT
  created_at TIMESTAMPTZ
  last_active_at TIMESTAMPTZ
  expires_at TIMESTAMPTZ     -- created_at + 15h
  ended_at TIMESTAMPTZ
  end_reason TEXT
  grace_used BOOLEAN DEFAULT false
```

### القديم (يجب نقله)
- **مدة الجلسة:** 15 ساعة max
- **Grace Period:** إشعار قبل الانتهاء، 5 دقائق مرة واحدة فقط
- **Single-Device:** عند الدخول من جهاز جديد، يقتل الجلسة القديمة (عبر Realtime)

**⚠️ هذا الجزء لم يُنقل بعد — يُعتبر TODO حرج**

---

## 8️⃣ الأدوار والصلاحيات

### ROLE_META (في `shared/lib/roles.ts`)
كما هو موضح في القسم 1.

### المصدر الحقيقي للصلاحيات
- **جدول `role_catalog`:** يعرّف الأدوار المتاحة
- **جدول `role_permissions`:** يربط كل دور بصلاحيات (app_id, can_view, can_edit...)
- **دوال SQL:** `is_admin()`, `is_catalog_admin()` تفحص الدور

### ProtectedRoute usage
```tsx
<Route element={<ProtectedRoute allowedRoles={['super_admin', 'admin']} />}>
  <Route path="/admin/users" element={<UsersPage />} />
</Route>
```

### Supabase RLS
كل جدول له سياسات مبنية على `auth.uid()` + `profiles.role`:
```sql
-- مثال
CREATE POLICY "Admins can read audit log"
ON audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  )
);
```

---

## 9️⃣ الملفات والمجلدات

### الشجرة الكاملة (الحالة الحالية)
```
Vexoris/
├── web/                                    ← التطبيق
│   ├── public/
│   │   ├── _headers                        ← Cloudflare security headers
│   │   ├── _redirects                      ← SPA fallback (/* → /index.html)
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src/
│   │   ├── assets/
│   │   │   ├── hero.png
│   │   │   └── vite.svg
│   │   ├── core/
│   │   │   ├── auth.tsx                    ← AuthProvider + useAuth
│   │   │   ├── queryClient.ts              ← TanStack Query config
│   │   │   ├── rpc.ts                      ← ⭐ Typed RPC wrapper
│   │   │   ├── supabase.ts                 ← Supabase client
│   │   │   └── types.ts                    ← ⭐ OverviewStats, MonthlyTrendPoint, QualityKpis
│   │   ├── hooks/                          ← ⭐ جديد
│   │   │   └── useDashboard.ts             ← useOverviewStats, useMonthlyTrend, useQualityKpis
│   │   ├── modules/
│   │   │   ├── auth/                       ← Auth flow كامل
│   │   │   │   ├── AuthCallbackPage.tsx
│   │   │   │   ├── ChangePasswordPage.tsx
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── MfaSetupPage.tsx
│   │   │   │   ├── MfaVerifyPage.tsx
│   │   │   │   ├── ProfilePage.tsx
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   ├── SessionsPage.tsx
│   │   │   │   └── SetupAccountPage.tsx
│   │   │   └── dashboard/
│   │   │       ├── Dashboard.tsx           ← ⭐ KPI cards + charts (جديد)
│   │   │       └── Home.tsx                ← صفحة عامة (placeholder)
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── FontSizeControl.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Loading.tsx             ← FullPageLoading
│   │   │   │   ├── Logo.tsx                ← LogoMark
│   │   │   │   ├── PlaceholderPage.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── ThemeToggle.tsx
│   │   │   │   └── UserChip.tsx
│   │   │   ├── layouts/
│   │   │   │   ├── AppLayout.tsx           ← Layout للمسجلين
│   │   │   │   └── WorkspaceLayout.tsx     ← Layout لـ apps/*
│   │   │   └── lib/
│   │   │       ├── cn.ts                   ← clsx + twMerge
│   │   │       ├── format.ts               ← ⭐ fmtNum, fmtPct, fmtMonth, fmtDate
│   │   │       └── roles.ts                ← ⭐ ROLE_META, getRoleMeta
│   │   ├── App.tsx                         ← Routes
│   │   ├── index.css                       ← Tailwind + CSS vars (Aurora Sky)
│   │   ├── main.tsx                        ← Entry point
│   │   └── vite-env.d.ts
│   ├── .env.example
│   ├── .env.local                          ← ⚠️ مش في git
│   ├── .gitignore
│   ├── .oxlintrc.json
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
│   ├── vite.config.ts
│   └── wrangler.jsonc                      ← Cloudflare Pages config
│
├── /workspaces/_db_backups/                ← ⚠️ خارج الريبو
│   ├── old_schema.sql                      ← 127KB — schema
│   ├── old_data.sql                        ← 104MB — data (مش في git)
│   ├── old_auth_data.sql                   ← auth.users + identities
│   ├── doctors_only.sql                    ← extract
│   └── reviews_only.sql                    ← extract 64MB
│
└── .gitignore                              ← محدّث ليتجاهل *.sql + .env*
```

### نقاط دخول رئيسية

**`App.tsx`:**
```tsx
<Routes>
  {/* Public */}
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/auth/callback" element={<AuthCallbackPage />} />
  <Route path="/auth/setup-account" element={<SetupAccountPage />} />
  <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />
  <Route path="/auth/mfa" element={<MfaVerifyPage />} />

  {/* Protected */}
  <Route element={<ProtectedRoute />}>
    <Route element={<AppLayout />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/sessions" element={<SessionsPage />} />
    </Route>
  </Route>
</Routes>
```

---

## 🔟 نظام التصميم — Aurora Sky

### الألوان (CSS Variables في `index.css`)
```css
:root {
  /* Dark mode (default) */
  --bg: #04070f;
  --bg-2: #0a1020;
  --surface: rgba(15, 23, 42, 0.55);
  --surface-2: rgba(30, 41, 59, 0.6);
  --line: rgba(148, 163, 184, 0.12);
  --ink: #f1f5f9;
  --ink-2: #cbd5e1;
  --ink-3: #94a3b8;
  --ink-4: #64748b;

  --primary: #0ea5e9;
  --primary-soft: rgba(14, 165, 233, 0.12);
  --primary-glow: rgba(14, 165, 233, 0.4);

  --grad-from: #0ea5e9;
  --grad-to: #8b5cf6;

  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #06b6d4;
}

html:not(.dark) {
  /* Light mode */
  --bg: #f5f8fc;
  --surface: rgba(255, 255, 255, 0.85);
  --ink: #0f172a;
  /* ... */
}
```

### Aurora Background
```css
.aurora-bg {
  background:
    radial-gradient(ellipse 60% 50% at 15% 10%, rgba(14, 165, 233, 0.18) 0%, transparent 60%),
    radial-gradient(ellipse 50% 45% at 85% 25%, rgba(99, 102, 241, 0.16) 0%, transparent 60%),
    radial-gradient(ellipse 60% 50% at 50% 95%, rgba(139, 92, 246, 0.14) 0%, transparent 65%);
}
```

### Grid Overlay
```css
.grid-overlay {
  background-image:
    linear-gradient(to right, rgba(148, 163, 184, 0.045) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.045) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 20%, #000 40%, transparent 100%);
}
```

### Classes المعاد استخدامها
```css
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  backdrop-filter: blur(20px) saturate(180%);
}

.btn { /* base */ }
.btn-primary { background: var(--primary); color: #fff; }
.btn-secondary { background: var(--surface-2); }
.btn-ghost { /* transparent */ }
.btn-icon { width: 32px; height: 32px; /* ... */ }

.input {
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  /* focus: border-primary + ring */
}

.label { font-size: 11px; font-weight: 700; color: var(--ink-2); }
```

### الخطوط
- **Tajawal** (Google Fonts) — للنصوص العربية
- **Space Grotesk** — للأرقام والـ branding
- **Fallback:** `system-ui, sans-serif`

### الأنيميشن
- **framer-motion** لكل الانتقالات
- **pattern:** `initial={{ opacity: 0, y: 12 }}` → `animate={{ opacity: 1, y: 0 }}`
- **Easing:** `[0.16, 1, 0.3, 1]` (custom cubic-bezier)
- **Duration:** 0.35-0.5 ثانية

### RTL Handling
- `<html lang="ar" dir="rtl">` في `index.html`
- Tailwind classes: `pr-9`, `pl-9` (logical properties)
- `dir="ltr"` على chart containers (recharts يعمل LTR)

---

## 1️⃣1️⃣ النشر — Cloudflare Pages

### الإعدادات المطلوبة
```
Framework preset: Vite (auto-detect)
Root directory: web
Build command: npm run build
Build output directory: dist
Node version: 20
```

### Environment Variables (Production)
```
VITE_SUPABASE_URL = https://iobrgmqbxqoquedegnpp.supabase.co
VITE_SUPABASE_ANON_KEY = sb_publishable_qYZ_Wp41ZHrlCmaF_nz96w_iz6iKDpm
```

**⚠️ مهم:** Vite يحقن env vars **وقت البناء** (build time)، لذا:
- لازم تكون موجودة **قبل** `npm run build`
- Retry build **مش** كفاية — لازم Retry deployment

### ملفات التكوين
**`web/wrangler.jsonc`:**
```jsonc
{
  "name": "vexoris",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2025-01-01"
}
```

**`web/public/_headers`:**
```
/assets/*.js
  Content-Type: application/javascript; charset=utf-8

/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**`web/public/_redirects`:**
```
/*    /index.html    200
```

### Supabase URL Configuration
**مطلوب في Dashboard:**
```
Authentication → URL Configuration → Site URL:
https://your-domain.pages.dev

Redirect URLs:
https://your-domain.pages.dev/**
https://your-domain.pages.dev/auth/callback
http://localhost:5173/**
```

---

## 1️⃣2️⃣ الـ RPCs المتاحة

### تم اختبارها ويعمل (22 نوفمبر)

#### `get_overview_stats(p_start, p_end, p_date_type)`
**المدخلات:** `p_date_type` ∈ `['discharge', 'admission', 'review']`
**المخرجات:**
```json
{
  "overall_pct": 73,
  "total_forms": 108,
  "total_units": 144457,
  "total_clerks": 151,
  "total_nurses": 1936,
  "total_doctors": 1347,
  "total_reviews": 2940
}
```
**⚠️ بطيء (30s+) — يحتاج caching**

#### `get_monthly_trend(p_months_back, p_date_type, p_mode)`
**المخرجات:**
```json
[
  { "month": "2025-12", "count": 1644, "percentage": 76, "total_score": 2498 },
  { "month": "2026-01", "count": 18814, "percentage": 63, "total_score": 23813 },
  ...
]
```
**✅ يعمل بسرعة**

#### `get_quality_kpis(p_start, p_end, p_date_type)`
**المخرجات:**
```json
{
  "avg_quality": 72,
  "total_files": 2960,
  "top_reviewer": "سماح رمضان",
  "working_days": 249,
  "total_reviewers": 20,
  "avg_per_reviewer": 148.0
}
```
**✅ يعمل بسرعة**

#### `get_departments_stats(...)`
**⚠️ signature مختلف!**
الـ actual:
```sql
get_departments_stats(p_date_type text, p_end date, p_sort_by text, p_start date)
```
**مش** `(p_start, p_end, p_date_type, p_sort_by, p_min_count)` كما هو متوقع من `session-manager.js` القديم.

**TODO:** افحص نفس النمط لكل `get_*_stats`.

### لم تُختبر بعد
- `get_doctors_stats`, `get_nurses_stats`, `get_clerks_stats`, `get_forms_stats`
- `get_quality_compare`, `get_quality_reviewers`, `get_quality_reviewer_details`
- `get_quality_specialties`, `get_quality_errors`, `get_quality_daily`
- `get_comparison`, `get_item_details`
- `get_my_sessions`, `kill_session`

**TODO:** اكتشف signatures الحقيقية + Types لكل RPC قبل البناء عليها.

---

## 1️⃣3️⃣ الصفحات — الوضع الحالي

### ✅ مكتمل ويعمل

| الصفحة | Route | الحالة |
|---|---|---|
| Login | `/login` | ✅ يعمل بالكامل |
| Auth Callback | `/auth/callback` | ✅ مع PKCE |
| Setup Account | `/auth/setup-account` | ✅ |
| MFA Setup | `/auth/mfa-setup` | ✅ QR + verify |
| MFA Verify | `/auth/mfa` | ✅ |
| Dashboard | `/dashboard` | ✅ KPIs + Chart (جديد) |
| Profile | `/profile` | ✅ |
| Change Password | `/change-password` | ✅ |
| Sessions | `/sessions` | ✅ (يستخدم `user_sessions`) |

### 🟡 جزئي

| الصفحة | Route | الناقص |
|---|---|---|
| Home | `/` | placeholder — يحتاج تصميم حقيقي |

### ❌ غير مبني

**Public:**
- `/about` — عن النظام
- `/security` — درع VEXORIS
- `/courses` — دورات تدريبية
- `/feedback` — رأيك يهمنا
- `/whitepaper` — whitepaper PDF

**Admin:**
- `/admin/users` — إدارة المستخدمين
- `/admin/rbac` — الصلاحيات
- `/admin/catalogs` — قوائم النظام
- `/admin/audit-log` — سجل التدقيق

**Apps:**
- `/apps/medical-audit` — الشاشة الرئيسية للعمل
- `/apps/medical-audit-report` — تقرير فردي
- `/apps/medical-analytics` — التقارير
- `/apps/workflow` — سير العمل
- `/apps/worcspacedown` — (غير واضح الغرض)

---

## 1️⃣4️⃣ الأخطاء المعروفة والمشاكل التقنية

### 🔴 حرجة (يجب حلّها)

#### 1. `get_overview_stats` بطيء
- **الأعراض:** timeout أحيانًا (30s)
- **السبب:** full scan على `audit_units_flat` (144K سطر) بدون materialized view
- **التأثير:** Dashboard يستغرق 30-60s في أول تحميل
- **الحل الحالي:** cache 5 دقائق في React Query
- **الحل الدائم (TODO):** materialized view + refresh cron

#### 2. `session-guard` غير موجود في React
- **الأعراض:** لا توجد حماية ضد:
  - جلسة > 15 ساعة
  - grace period
  - single-device enforcement
- **السبب:** القديم كان في `session-guard.js` ولم يُنقل
- **TODO:** بناء `useSessionGuard` hook + Realtime subscription

#### 3. RPC signatures مختلفة عن المتوقع
- **الأعراض:** `get_departments_stats` فشل
- **السبب:** الكود القديم استخدم `p_min_count` لكن الدالة لا تقبله
- **TODO:** فحص كل RPC + تحديث `rpc.ts` + Types

### 🟡 متوسطة

#### 4. `.env.local` في Cloudflare
- **الأعراض:** `Missing Supabase env vars` عند النشر
- **السبب:** Vite يحقن env vars وقت البناء، وكانت غير موجودة
- **الحل:** أضفها في Cloudflare Build Environment + Retry deployment
- **الحالة:** ✅ تم الحل

#### 5. الملفات الكبيرة في git
- **الأعراض:** push رُفض (`old_data.sql` 104MB)
- **السبب:** db dumps فيها PII
- **الحل:** نقلها لـ `/workspaces/_db_backups/` + تحديث `.gitignore`
- **الحالة:** ✅ تم الحل (لكن الـ commit رُفض)

#### 6. `profiles` RLS policy فضفاضة
- **الحالية:** "Public profiles are viewable by everyone"
- **المشكلة:** أي حد (حتى غير مسجل) يقدر يقرأ الـ profiles
- **TODO:** تغييرها لـ `authenticated` فقط

### 🟢 منخفضة

- **`sb_publishable_*` key نوعه جديد** — يحتاج `@supabase/supabase-js` v2.45+
- **No Error Boundary** — أي خطأ في component يكسر الصفحة كاملة
- **No loading skeletons في بعض الصفحات**
- **`AuthCallbackPage` قد لا يحل PKCE لو الـ URL فيه hash fragment** (يحتاج اختبار)

---

## 1️⃣5️⃣ البيئة والمفاتيح

### Supabase

| | URL | Ref |
|---|---|---|
| القديم | `https://omezrsyjsxdeaautmsad.supabase.co` | `omezrsyjsxdeaautmsad` |
| الجديد | `https://iobrgmqbxqoquedegnpp.supabase.co` | `iobrgmqbxqoquedegnpp` |

**Connection strings (Session pooler):**
```
postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```
⚠️ **لا تستخدم** Transaction pooler (port 6543) مع `pg_dump`.

### Anon Key (الجديد)
```
sb_publishable_qYZ_Wp41ZHrlCmaF_nz96w_iz6iKDpm
```
- Public by design — يظهر في bundle
- **لا** يستخدم service_role في التطبيق أبدًا

### Environment Variables

**محليًا (`web/.env.local` — gitignored):**
```bash
VITE_SUPABASE_URL="https://iobrgmqbxqoquedegnpp.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_qYZ_Wp41ZHrlCmaF_nz96w_iz6iKDpm"
```

**Cloudflare Pages (Production):**
نفس القيم في Dashboard → Settings → Environment variables → **Production**

### GitHub
- Repo: `VexorisV1/Vexoris`
- Branch: `main`
- Auto-deploy: كل push → Cloudflare build

---

## 1️⃣6️⃣ الدروس المستمادة من الترحيل

### ✅ ما نجح

1. **`pg_dump` 17 لسيرفر 17.11** — لا تعتمد على إصدار Ubuntu الافتراضي (16)
2. **Session pooler (5432)** — Transaction pooler (6543) لا يعمل مع `pg_dump`
3. **`--schema-only` + `--data-only` منفصلين** — أسهل للتشخيص
4. **`SET session_replication_role = replica`** — كسر FK مؤقتًا للـ data load
5. **إصلاح sequences بعد الـ load** — `setval` لكل `*_id_seq`
6. **استخراج جداول فردية بـ `awk`** — لما COPY يفشل بسبب سطر واحد

### ⚠️ ما فشل (وتعلّمنا منه)

1. **`--use-copy` مش خيار موجود** — `pg_dump` يستخدم COPY تلقائيًا
2. **`grep '^ERROR'` مش بيلقط أخطاء COPY** — استخدم `grep -iE 'error|copy'`
3. **`sb_publishable_*` مع `<` في البداية** — placeholder chars تتحفظ حرفيًا
4. **History expansion (`!`) في bash** — استخدم single quotes أو `set +H`
5. **Commit قبل `.gitignore`** — يرفض push، يضيع وقت
6. **الاعتماع على `psql -v ON_ERROR_STOP=0`** — يكمل رغم الأخطاء، يخفي مشاكل

### 📋 Checklist للترحيل القادم

```
□ تحقق من إصدار pg_dump مقابل السيرفر
□ استخدم Session pooler (5432)
□ --schema-only أولاً، ثم --data-only
□ --no-owner --no-privileges
□ توقّع أخطاء auth/extensions — تجاهلها
□ auth.users + auth.identities قبل public data
□ SET session_replication_role = replica للـ data load
□ أصلح sequences بعد الـ load
□ تحقق من الأعداد في القديم والجديد
□ .gitignore قبل commit
□ حرّك db dumps خارج الريبو
□ امسح history في bash لو فيه passwords
□ غيّر passwords بعد أي تسريب
```

---

## 1️⃣7️⃣ الخطوات القادمة (Roadmap)

### المرحلة الحالية: بناء الصفحات الأساسية

#### أولوية 1: Public Pages (2-3 أيام)
1. **Home (`/`)** — تصميم Aurora Sky، Hero section، features، CTA
2. **About (`/about`)** — عن النظام، فريق العمل، الرؤية
3. **Security (`/security`)** — Whitepaper + الميزات الأمنية
4. **Courses (`/courses`)** — دورات (لو فيه محتوى)
5. **Feedback (`/feedback`)** — form يتصل بـ `feedback` table (لو موجود)
6. **Whitepaper (`/whitepaper`)** — PDF viewer

**ملفات مساعدة:**
- `shared/components/PublicHeader.tsx` — Header بسيط
- `shared/layouts/PublicLayout.tsx` — Layout لصفحات عامة
- `shared/components/Hero.tsx` — Hero section reusable
- `shared/components/FeatureCard.tsx`

#### أولوية 2: Admin Pages (3-4 أيام)
1. **`/admin/users`** — قائمة المستخدمين + CRUD + role management
2. **`/admin/audit-log`** — سجل التدقيق + filters + export
3. **`/admin/rbac`** — إدارة الصلاحيات
4. **`/admin/catalogs`** — قوائم النظام (departments, doctors, forms, ...)

**Hooks جديدة:**
- `useUsers()`, `useAuditLog()`, `useRolePermissions()`, `useCatalogs()`

#### أولوية 3: Apps (5-7 أيام)
1. **`/apps/medical-audit`** — الشاشة الرئيسية للعمل
2. **`/apps/medical-analytics`** — التقارير
3. **`/apps/medical-audit-report`** — تقرير فردي
4. **`/apps/workflow`** — سير العمل

### تحسينات تقنية (بالتوازي)

- [ ] **`useSessionGuard` hook** (15h + grace + single-device)
- [ ] **Error Boundary** global
- [ ] **Loading skeletons** لكل query
- [ ] **Materialized view** لـ `audit_units_flat` (performance)
- [ ] **Export utilities** (`pdf-arabic.ts` + Excel)
- [ ] **Dynamic issue labels** (`get_all_issue_labels` → `Object.assign`)
- [ ] **Fix RPC signatures** — فحص كل 48 دالة
- [ ] **Security audit** على RLS policies

### Cleanup

- [ ] حذف الـ `web/src/assets/hero.png` و `vite.svg` (مش مستخدمين)
- [ ] إضافة favicon مخصص VEXORIS
- [ ] `.env.local.bak` — امسح (في git)
- [ ] `dist/` و `.wrangler/` في `.gitignore`

---

## 📌 ملاحظات أخيرة

### قاعدة ذهبية
> **"صفر بيانات وهمية"** — كل حقل يظهر في UI لازم يكون من DB حقيقية (RPC/Query)، مفيش mock/dummy/hardcoded.

### عند إضافة صفحة جديدة
1. حدد الـ route في `App.tsx` (public أم protected؟)
2. لو محتاجة DB، أضف RPC + Hook في `hooks/`
3. استخدم `shared/components/` الموجودة
4. التزم بـ **Aurora Sky** design tokens (CSS vars)
5. أضف loading + error states
6. استخدم `framer-motion` للانتقالات

### عند إضافة RPC
1. اختبر signature الحقيقي من Supabase SQL Editor
2. أضف Type في `core/types.ts`
3. أضف method في `core/rpc.ts`
4. أضف hook في `hooks/`
5. استخدمه في الـ component

### عند إضافة role جديد
1. أضفه في `role_catalog` table
2. أضف صلاحياته في `role_permissions`
3. أضفه في `shared/lib/roles.ts` → `ROLE_META`
4. استخدمه في `ProtectedRoute allowedRoles`

---

**نهاية Handoff V10.**
**آخر تحديث:** 22 نوفمبر 2025 — بعد نجاح ترحيل DB + بناء أول Dashboard.

**الخطوة القادمة المقترحة:** بناء `PublicLayout` + `Home` page.