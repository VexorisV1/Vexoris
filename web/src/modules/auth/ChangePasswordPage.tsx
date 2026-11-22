import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/auth';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (newPass.length < 8) return setMsg({ type: 'err', text: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    if (newPass !== confirm) return setMsg({ type: 'err', text: 'كلمتا المرور غير متطابقتين' });
    setSaving(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: current });
      if (signErr) throw new Error('كلمة المرور الحالية غير صحيحة');
      const { error: updErr } = await supabase.auth.updateUser({ password: newPass });
      if (updErr) throw updErr;
      setMsg({ type: 'ok', text: 'تم تحديث كلمة المرور بنجاح' });
      setCurrent(''); setNewPass(''); setConfirm('');
    } catch (err: unknown) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'فشل التحديث' });
    } finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-md">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)' }}>تغيير كلمة المرور</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>اختر كلمة مرور قوية</p>
      </div>
      <form onSubmit={submit} className="card p-5 sm:p-6 space-y-4">
        {msg && (
          <div className="p-3 rounded-xl flex items-start gap-2 text-[11px]"
            style={msg.type === 'ok'
              ? { background: 'rgba(8,145,178,0.10)', border: '1px solid rgba(8,145,178,0.25)', color: 'var(--success)' }
              : { background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)' }}>
            {msg.type === 'ok' ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
            <span className="font-semibold">{msg.text}</span>
          </div>
        )}
        <div>
          <label className="label block mb-2">كلمة المرور الحالية</label>
          <input type={show ? 'text' : 'password'} required value={current} onChange={(e) => setCurrent(e.target.value)}
            className="input" disabled={saving} />
        </div>
        <div>
          <label className="label block mb-2">كلمة المرور الجديدة</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} required value={newPass} onChange={(e) => setNewPass(e.target.value)}
              className="input pl-9" disabled={saving} />
            <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 left-2 -translate-y-1/2 btn-icon"
              style={{ width: '24px', height: '24px' }}>
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label block mb-2">تأكيد كلمة المرور</label>
          <input type={show ? 'text' : 'password'} required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="input" disabled={saving} />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary w-full h-10">
          <ShieldCheck size={14} /> {saving ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
        </button>
      </form>
    </motion.div>
  );
}
