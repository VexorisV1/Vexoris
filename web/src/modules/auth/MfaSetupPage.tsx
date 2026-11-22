import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertCircle, Copy, Check, ArrowRight } from 'lucide-react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/auth';
import { FullPageLoading } from '@/shared/components/Loading';

const REQUIRED_MFA = ['super_admin', 'admin', 'manager'];

export default function MfaSetupPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const role = profile?.role || 'viewer';
  const requiresMfa = REQUIRED_MFA.includes(role);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('mfa_setup_done').eq('id', user.id).single();
      if (data?.mfa_setup_done) { navigate('/dashboard', { replace: true }); return; }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp || []) {
        if (f.status === 'verified') { navigate('/dashboard', { replace: true }); return; }
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
      const { data: enroll, error: eErr } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'VEXORIS' });
      if (eErr || !enroll) { setError(eErr?.message || 'فشل إنشاء عامل MFA'); return; }
      setFactorId(enroll.id); setQrCode(enroll.totp.qr_code); setSecret(enroll.totp.secret); setReady(true);
    })();
  }, [user, navigate]);

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const arr = [...code]; arr[i] = val; setCode(arr);
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
    if (arr.every(c => c)) verify(arr.join(''));
  }

  async function verify(full: string) {
    setError(''); setSubmitting(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: full });
      if (vErr) throw vErr;
      await supabase.from('profiles').update({ mfa_setup_done: true }).eq('id', user!.id);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'الرمز غير صحيح';
      setError(msg === 'Invalid TOTP code entered' ? 'الرمز غير صحيح' : msg);
      setCode(['', '', '', '', '', '']); inputsRef.current[0]?.focus();
    } finally { setSubmitting(false); }
  }

  async function skip() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    navigate('/dashboard', { replace: true });
  }

  function copySecret() { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  if (loading || !ready) return <FullPageLoading label="جارٍ إعداد MFA..." />;

  return (
    <div className="min-h-[calc(100vh-220px)] flex items-center justify-center px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--primary-soft)', color: 'var(--primary)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 30%, transparent)' }}>
              <ShieldCheck size={26} />
            </div>
            <h1 className="text-xl font-extrabold" style={{ color: 'var(--ink)' }}>التحقق الثنائي</h1>
            <p className="mt-1 text-xs text-center" style={{ color: 'var(--ink-3)' }}>امسح الرمز بتطبيق Google Authenticator</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl flex items-start gap-2 text-[11px]"
              style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" /><span className="font-semibold">{error}</span>
            </div>
          )}

          <div className="flex justify-center mb-5">
            <div className="p-3 rounded-xl" style={{ background: '#fff' }}>
              <img src={qrCode} alt="QR" className="w-40 h-40 block" />
            </div>
          </div>

          <div className="mb-5">
            <div className="label mb-2">أو أدخل الرمز يدوياً</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2.5 rounded-lg text-[11px] font-mono break-all"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}>{secret}</code>
              <button type="button" onClick={copySecret} className="btn btn-secondary h-9 px-3">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="label mb-2">أدخل الرمز المكوّن من 6 أرقام</div>
          <div className="flex justify-center gap-1.5 mb-4" dir="ltr">
            {code.map((d, i) => (
              <input key={i} ref={el => { inputsRef.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                value={d} onChange={(e) => handleChange(i, e.target.value)} disabled={submitting}
                className="w-10 h-12 text-center text-lg font-bold rounded-xl outline-none transition-all"
                style={{ background: 'var(--bg-2)',
                  border: d ? '1.5px solid var(--primary)' : '1px solid var(--line)',
                  color: 'var(--ink)', boxShadow: d ? '0 0 0 3px var(--primary-soft)' : 'none' }} />
            ))}
          </div>

          {submitting && <div className="text-center text-xs font-semibold" style={{ color: 'var(--primary)' }}>جارٍ التحقق...</div>}

          {!requiresMfa && (
            <button type="button" onClick={skip} className="btn btn-ghost w-full h-9 mt-4 text-xs">
              تخطي الآن (يمكنك التفعيل لاحقاً) <ArrowRight size={13} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
