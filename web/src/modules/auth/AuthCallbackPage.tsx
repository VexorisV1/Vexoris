import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FullPageLoading } from '@/shared/components/Loading';
import { supabase } from '@/core/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) { navigate('/login', { replace: true }); return; }
      const { data: profile } = await supabase.from('profiles')
        .select('password_changed, mfa_setup_done').eq('id', data.session.user.id).single();
      if (profile && !profile.password_changed) { navigate('/auth/setup-account', { replace: true }); return; }
      if (profile && !profile.mfa_setup_done) { navigate('/auth/mfa-setup', { replace: true }); return; }
      navigate('/dashboard', { replace: true });
    })();
  }, [navigate]);
  return <FullPageLoading label="جارٍ إتمام التحقق..." />;
}
