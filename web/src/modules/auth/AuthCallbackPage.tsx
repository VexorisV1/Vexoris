import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FullPageLoading } from '@/shared/components/Loading';
import { supabase } from '@/core/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        // 1. Handle PKCE code exchange (OAuth / email confirmation links)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchErr) throw exchErr;
        }

        // 2. Now read the session
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          navigate('/login', { replace: true });
          return;
        }

        // 3. Check onboarding state
        const { data: profile } = await supabase
          .from('profiles')
          .select('password_changed, mfa_setup_done')
          .eq('id', data.session.user.id)
          .single();

        if (profile && !profile.password_changed) {
          navigate('/auth/setup-account', { replace: true });
          return;
        }
        if (profile && !profile.mfa_setup_done) {
          navigate('/auth/mfa-setup', { replace: true });
          return;
        }
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  return <FullPageLoading label="جارٍ إتمام التحقق..." />;
}
