import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/auth';
import { FullPageLoading } from '@/shared/components/Loading';

function strength(pass: string) {
  let s = 0;
  if (pass.length >= 8) s++;
  if (/[A-Z]/.test(pass)) s++;
  if (/[0-9]/.test(pass)) s++;
  if (/[^A-Za-z0-9]/.test(pass)) s++;
  const cfg = [
    { label: 'ضعيفة جداً', color: 'var(--danger)' }, { label: 'ضعيفة', color: 'var(--warning)' },
    { label: 'متوسطة', color: 'var(--info)' }, { label: 'قوية', color: 'var(--primary)' },
  ];
  return { score: s, ...(cfg[Math.max(0, Math.min(s - 1, 3))]) };
}

export default function SetupAccountPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('password_changed').eq('id', user.id).single();
      if (data?.password_changed) navigate('/dashboard', { replace: true });
      else setChecking(false);
    })();
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (pass.length < 8) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    if (pass !== confirm) return setError('كلمتا المرور غير متطابقتين');
    setSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: pass });
      if (updErr) throw updErr;
      const { error: profErr } = await supabase.from('profiles').update({ password_changed: true }).eq('id', user!.id);
      if (profErr) throw profErr;
      navigate('/auth/mfa-setup', { replace: true });
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'خطأ غير متوقع'); }
    finally { setSubmitting(false); }
  }

  if (loading || checking) return <FullPageLoading label="جارٍ التحقق..." />;
  const s = strength(pass);

  return (
    <div className="min-h-[calc(100vh-220px)] flex items-center justify-center px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--primary-soft)', color: 'var(--primary)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 30%, transparent)' }}>
              <Lock size={24} />
            </div>
            <h1 className="text-xl font-extrabold" style={{ color: 'var(--ink)' }}>تأمين حسابك</h1>
            <p className="mt-1 text-xs text-center" style={{ color: 'var(--ink-3)' }}>عيّن كلمة مرور جديدة قبل المتابعة</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl flex items-start gap-2 text-[11px]"
              style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" /><span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-2">كلمة المرور الجديدة</label>
              <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)}
                className="input" placeholder="8 أحرف على الأقل" disabled={submitting} />
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(s.score / 4) * 100}%`, background: s.color }} />
              </div>
              <div className="text-[10.5px] mt-1 font-semibold" style={{ color: s.color }}>{s.label}</div>
            </div>
            <div>
              <label className="label block mb-2">تأكيد كلمة المرور</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="input" placeholder="أعد الإدخال" disabled={submitting} />
            </div>
            <button type="submit" disabled={submitting} className="btn btn-primary w-full h-10 text-sm">
              {submitting ? 'جارٍ الحفظ...' : 'حفظ ومتابعة'} <ArrowLeft size={14} />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
