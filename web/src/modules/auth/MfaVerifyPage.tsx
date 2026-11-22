import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/core/supabase';

export default function MfaVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/dashboard';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputsRef.current[0]?.focus(); }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const newCode = [...code]; newCode[index] = value; setCode(newCode);
    if (value && index < 5) inputsRef.current[index + 1]?.focus();
    if (newCode.every(c => c)) verify(newCode.join(''));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputsRef.current[index - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setCode(pasted.split('')); verify(pasted); }
  }

  async function verify(fullCode: string) {
    setError(''); setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find(f => f.status === 'verified');
      if (!totp) throw new Error('لا يوجد عامل MFA مفعّل على حسابك');
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: totp.id, challengeId: challenge.id, code: fullCode });
      if (verifyErr) throw verifyErr;
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'الرمز غير صحيح';
      setError(msg === 'Invalid TOTP code entered' ? 'الرمز غير صحيح. حاول مرة أخرى.' : msg);
      setCode(['', '', '', '', '', '']); inputsRef.current[0]?.focus();
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-[calc(100vh-220px)] flex items-center justify-center px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 30%, transparent), 0 8px 24px -8px var(--primary-glow)' }}>
              <ShieldCheck size={26} />
            </div>
            <h1 className="text-xl font-extrabold" style={{ color: 'var(--ink)' }}>التحقق الثنائي</h1>
            <p className="mt-1 text-xs text-center" style={{ color: 'var(--ink-3)' }}>أدخل الرمز المكوّن من 6 أرقام</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl flex items-start gap-2 text-[11px]"
              style={{ background: 'rgba(220, 38, 38, 0.10)', border: '1px solid rgba(220, 38, 38, 0.25)', color: 'var(--danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" /><span className="font-semibold">{error}</span>
            </div>
          )}

          <div className="flex justify-center gap-1.5 sm:gap-2 mb-6" dir="ltr" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input key={i} ref={el => { inputsRef.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                value={digit} onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)} disabled={loading}
                className="w-10 h-12 sm:w-11 text-center text-lg font-bold rounded-xl outline-none transition-all"
                style={{ background: 'var(--bg-2)',
                  border: digit ? '1.5px solid var(--primary)' : '1px solid var(--line)',
                  color: 'var(--ink)', boxShadow: digit ? '0 0 0 3px var(--primary-soft)' : 'none' }} />
            ))}
          </div>

          {loading && <div className="text-center text-xs font-semibold" style={{ color: 'var(--primary)' }}>جارٍ التحقق...</div>}
          <div className="text-center text-[11px] mt-2" style={{ color: 'var(--ink-3)' }}>
            لم تستلم الرمز؟ تحقق من تطبيق المصادقة.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
