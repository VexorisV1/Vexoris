import { supabase } from '@/core/supabase';

export const AUDIT = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_CHANGED: 'password_changed',
  MFA_ENABLED: 'mfa_enabled',
  MFA_DISABLED: 'mfa_disabled',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  ROLE_CHANGED: 'role_changed',
  PROFILE_UPDATED: 'profile_updated',
  AUDIT_LOG_EXPORTED: 'audit_log_exported',
  AUDIT_LOG_BULK_DELETED: 'audit_log_bulk_deleted',
  REVIEW_CREATED: 'review_created',
  REVIEW_UPDATED: 'review_updated',
  REVIEW_DELETED: 'review_deleted',
  FILE_UPLOADED: 'file_uploaded',
  SESSION_KILLED: 'session_killed',
  DEVICE_TRUSTED: 'device_trusted',
} as const;

export interface ActionMeta {
  label: string;
  icon: string;
  color: string;
}

export const AUDIT_LABELS: Record<string, ActionMeta> = {
  login:                  { label: 'تسجيل دخول', icon: 'log-in', color: '#10b981' },
  logout:                 { label: 'تسجيل خروج', icon: 'log-out', color: '#64748b' },
  login_failed:           { label: 'محاولة دخول فاشلة', icon: 'shield-x', color: '#ef4444' },
  password_changed:       { label: 'تغيير كلمة المرور', icon: 'key', color: '#f59e0b' },
  mfa_enabled:            { label: 'تفعيل MFA', icon: 'shield-check', color: '#10b981' },
  mfa_disabled:           { label: 'تعطيل MFA', icon: 'shield-off', color: '#ef4444' },
  user_created:           { label: 'إنشاء مستخدم', icon: 'user-plus', color: '#0ea5e9' },
  user_updated:           { label: 'تعديل مستخدم', icon: 'user-pen', color: '#0ea5e9' },
  user_deleted:           { label: 'حذف مستخدم', icon: 'user-x', color: '#ef4444' },
  role_changed:           { label: 'تغيير صلاحيات', icon: 'shield', color: '#8b5cf6' },
  profile_updated:        { label: 'تعديل الملف الشخصي', icon: 'user', color: '#06b6d4' },
  audit_log_exported:     { label: 'تصدير سجل التدقيق', icon: 'download', color: '#10b981' },
  audit_log_bulk_deleted: { label: 'حذف سجلات تدقيق', icon: 'trash-2', color: '#ef4444' },
  review_created:         { label: 'إنشاء مراجعة', icon: 'clipboard-check', color: '#10b981' },
  review_updated:         { label: 'تعديل مراجعة', icon: 'clipboard-pen', color: '#f59e0b' },
  review_deleted:         { label: 'حذف مراجعة', icon: 'clipboard-x', color: '#ef4444' },
  file_uploaded:          { label: 'رفع ملف', icon: 'upload', color: '#0ea5e9' },
  session_killed:         { label: 'إنهاء جلسة', icon: 'power-off', color: '#f59e0b' },
  device_trusted:         { label: 'جهاز موثوق', icon: 'smartphone', color: '#10b981' },
};

export const getActionMeta = (action: string): ActionMeta =>
  AUDIT_LABELS[action] ?? { label: action, icon: 'activity', color: '#64748b' };

export const SEVERITY_LABELS: Record<string, { label: string; className: string }> = {
  info:     { label: 'معلومة',  className: 'severity-info' },
  warning:  { label: 'تحذير',   className: 'severity-warning' },
  critical: { label: 'حرج',     className: 'severity-critical' },
};

export const getSeverityLabel = (sev: string) =>
  SEVERITY_LABELS[sev] ?? { label: sev, className: 'severity-info' };

export async function logAudit(
  action: string,
  options: {
    description?: string;
    severity?: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
  } = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, role, display_name')
      .eq('id', user.id)
      .single();

    await supabase.from('audit_log').insert({
      action,
      description: options.description ?? null,
      severity: options.severity ?? 'info',
      metadata: options.metadata ?? null,
      user_id: user.id,
      user_email: profile?.email ?? user.email ?? null,
      user_role: profile?.role ?? null,
      user_agent: navigator.userAgent,
    });
  } catch (err) {
    console.error('logAudit failed:', err);
  }
}

export function parseDeviceName(ua: string | null | undefined): string {
  if (!ua) return 'جهاز غير معروف';
  let browser = 'متصفح';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  let os = 'جهاز';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} على ${os}`;
}
