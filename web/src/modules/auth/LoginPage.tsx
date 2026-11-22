import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/core/supabase';
import { LogoMark } from '@/shared/components/Logo';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedFactor = factors?.totp?.some(f => f.status === 'verified');
      if (hasVerifiedFactor) {
        navigate('/auth/mfa', { state: { from }, replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('password_changed, mfa_setup_done')
        .eq('id', data.user.id)
        .single();

      if (profile && !profile.password_changed) {
        navigate('/auth/setup-account', { replace: true });
        return;
      }
      if (profile && !profile.mfa_setup_done) {
        navigate('/auth/mfa-setup', { replace: true });
        return;
      }

      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      setError(msg === 'Invalid login credentials' ? 'البريد أو كلمة المرور غير صحيحة' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-220px)] flex items-center justify-center px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-md">
        <div className="card p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', opacity: 0.6 }} />

          <div className="flex flex-col items-center mb-6">
            <LogoMark size={56} />
            <h1 className="mt-4 text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>تسجيل الدخول</h1>
            <p className="mt-1 text-xs text-center" style={{ color: 'var(--ink-3)' }}>أدخل بياناتك للوصول إلى نظام VEXORIS</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl flex items-start gap-2 text-[11px] animate-scale-in"
              style={{ background: 'rgba(220, 38, 38, 0.10)', border: '1px solid rgba(220, 38, 38, 0.25)', color: 'var(--danger)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" /><span className="font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-2">البريد الإلكتروني</label>
              <div className="relative">
                <Mail size={14} className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-4)' }} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pr-9" placeholder="name@vexoris.com" autoComplete="email" disabled={loading} />
              </div>
            </div>

            <div>
              <label className="label block mb-2">كلمة المرور</label>
              <div className="relative">
                <Lock size={14} className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-4)' }} />
                <input type={showPassword ? 'text' : 'password'} required value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input px-9"
                  placeholder="••••••••" autoComplete="current-password" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 left-2 -translate-y-1/2 btn-icon" style={{ width: '24px', height: '24px' }} tabIndex={-1}>
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full h-10 text-sm group">
              {loading ? (<><span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />جارٍ التحقق...</>)
                : (<>دخول<ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" /></>)}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t text-center text-[11px]" style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}>
            نسيت كلمة المرور؟ <a href="mailto:admin@vexoris.com" className="font-bold" style={{ color: 'var(--primary)' }}>تواصل مع مسؤول النظام</a>
          </div>
        </div>

        <div className="mt-4 text-center text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
          <Link to="/" className="hover:underline">← العودة للرئيسية</Link>
        </div>
      </motion.div>
    </div>
  );
}
