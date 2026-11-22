import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './shared/layouts/AppLayout';
import { WorkspaceLayout } from './shared/layouts/WorkspaceLayout';
import { FullPageLoading } from './shared/components/Loading';
import { PlaceholderPage } from './shared/components/PlaceholderPage';
import { ProtectedRoute } from './modules/auth/ProtectedRoute';

const Home             = lazy(() => import('./modules/dashboard/Home'));
const Dashboard        = lazy(() => import('./modules/dashboard/Dashboard'));
const LoginPage        = lazy(() => import('./modules/auth/LoginPage'));
const MfaVerifyPage    = lazy(() => import('./modules/auth/MfaVerifyPage'));
const AuthCallbackPage = lazy(() => import('./modules/auth/AuthCallbackPage'));
const SetupAccountPage = lazy(() => import('./modules/auth/SetupAccountPage'));
const MfaSetupPage     = lazy(() => import('./modules/auth/MfaSetupPage'));
const ProfilePage      = lazy(() => import('./modules/auth/ProfilePage'));
const ChangePasswordPage = lazy(() => import('./modules/auth/ChangePasswordPage'));
const SessionsPage     = lazy(() => import('./modules/auth/SessionsPage'));

function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = `${e.clientX}px`;
        ref.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener('mousemove', h, { passive: true });
    return () => window.removeEventListener('mousemove', h);
  }, []);
  return <div ref={ref} className="cursor-glow" />;
}

export default function App() {
  return (
    <>
      <CursorGlow />
      <Suspense fallback={<FullPageLoading label="جارٍ التحميل..." />}>
        <Routes>
          {/* Public */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/mfa" element={<MfaVerifyPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/about" element={<PlaceholderPage title="عن النظام" />} />
            <Route path="/security" element={<PlaceholderPage title="الأمان" />} />
          </Route>

          {/* Auth required — no sidebar (setup flow) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/auth/setup-account" element={<SetupAccountPage />} />
              <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />
            </Route>
          </Route>

          {/* Auth required — with sidebar */}
          <Route element={<ProtectedRoute />}>
            <Route element={<WorkspaceLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/analytics" element={<PlaceholderPage title="التحليلات" />} />
              <Route path="/medical-audit" element={<PlaceholderPage title="المراجعة الطبية" />} />
              <Route path="/emergency-audit" element={<PlaceholderPage title="مراجعة الطوارئ" />} />
              <Route path="/doctor-notes" element={<PlaceholderPage title="ملاحظات الأطباء" />} />
              <Route path="/discharge" element={<PlaceholderPage title="مؤشر الخروج" />} />
              <Route path="/workflow" element={<PlaceholderPage title="سير العمل" />} />
              <Route path="/courses" element={<PlaceholderPage title="الدورات" />} />
              <Route path="/library" element={<PlaceholderPage title="المكتبة" />} />
              <Route path="/admin/users" element={<PlaceholderPage title="المستخدمون" />} />
              <Route path="/admin/rbac" element={<PlaceholderPage title="الصلاحيات" />} />
              <Route path="/admin/catalogs" element={<PlaceholderPage title="الفهارس" />} />
              <Route path="/admin/audit-log" element={<PlaceholderPage title="سجل التدقيق" />} />
              <Route path="/settings" element={<PlaceholderPage title="الإعدادات" />} />
              <Route path="/help" element={<PlaceholderPage title="المساعدة" />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
