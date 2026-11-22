export const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  super_admin: { label: 'المطور', color: '#8b5cf6', icon: 'shield-check' },
  admin:       { label: 'إدارة السجلات', color: '#0ea5e9', icon: 'settings' },
  manager:     { label: 'المدير الطبي', color: '#06b6d4', icon: 'briefcase-medical' },
  auditor:     { label: 'مراجع جودة', color: '#10b981', icon: 'clipboard-check' },
  senior:      { label: 'رئيس قسم', color: '#f59e0b', icon: 'user-cog' },
  doctor:      { label: 'طبيب', color: '#6366f1', icon: 'stethoscope' },
  reviewer_doctor: { label: 'طبيب مراجع', color: '#a855f7', icon: 'user-round-check' },
  viewer:      { label: 'مراجع', color: '#64748b', icon: 'eye' },
};

export const getRoleMeta = (role: string) =>
  ROLE_META[role] ?? { label: role, color: '#64748b', icon: 'user' };
