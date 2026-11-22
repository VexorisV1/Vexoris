import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Mail, Shield, Building2, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/auth';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'المطور', admin: 'إدارة السجلات', manager: 'المدير الطبي',
  auditor: 'مراجع جودة', senior: 'رئيس قسم', doctor: 'طبيب',
  reviewer_doctor: 'طبيب مراجع', viewer: 'مراجع',
};

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setDepartment((profile as { department?: string }).department || '');
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true); setMsg(null);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName.trim() || null,
        department: department.trim() || null,
      }).eq('id', user.id);
      if (error) throw error;
      setMsg({ type: 'ok', text: 'تم الحفظ بنجاح' });
    } catch (err: unknown) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'فشل الحفظ' });
    } finally { setSaving(false); }
  }

  const initial = (displayName || profile?.username || 'U').charAt(0).toUpperCase();
  const role = profile?.role || 'viewer';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)' }}>إدارة الحساب</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>تحديث معلوماتك الشخصية</p>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))', boxShadow: '0 8px 24px -6px var(--primary-glow)' }}>
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold truncate" style={{ color: 'var(--ink)' }}>{displayName || profile?.username}</div>
            <div className="text-xs mt-1 truncate" style={{ color: 'var(--ink-3)' }}>{user?.email}</div>
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
              <Shield size={10} />{ROLE_LABEL[role] || role}
            </div>
          </div>
        </div>

        {msg && (
          <div className="mb-4 p-3 rounded-xl flex items-start gap-2 text-[11px]"
            style={msg.type === 'ok'
              ? { background: 'rgba(8,145,178,0.10)', border: '1px solid rgba(8,145,178,0.25)', color: 'var(--success)' }
              : { background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)' }}>
            {msg.type === 'ok' ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
            <span className="font-semibold">{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label block mb-2 flex items-center gap-1"><User size={11} /> الاسم الكامل</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="input" placeholder="اسمك الكامل" disabled={saving} />
          </div>
          <div>
            <label className="label block mb-2 flex items-center gap-1"><Building2 size={11} /> القسم</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
              className="input" placeholder="مثال: إدارة الجودة" disabled={saving} />
          </div>
          <div>
            <label className="label block mb-2 flex items-center gap-1"><Mail size={11} /> البريد الإلكتروني</label>
            <input type="email" value={user?.email || ''} readOnly className="input opacity-60 cursor-not-allowed" />
          </div>
          <div>
            <label className="label block mb-2 flex items-center gap-1"><Shield size={11} /> الدور</label>
            <input type="text" value={ROLE_LABEL[role] || role} readOnly className="input opacity-60 cursor-not-allowed" />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t flex justify-end" style={{ borderColor: 'var(--line)' }}>
          <button onClick={save} disabled={saving} className="btn btn-primary h-9 px-5">
            <Save size={13} /> {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
