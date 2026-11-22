import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Globe, Clock, LogOut, AlertCircle, Activity } from 'lucide-react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/auth';

interface SessionRow {
  id: string; device: string | null; user_agent: string | null; ip_address: string | null;
  created_at: string; last_active: string; ended_at: string | null;
}

function detectDevice(ua: string | null): { icon: 'mobile' | 'desktop'; label: string } {
  if (!ua) return { icon: 'desktop', label: 'جهاز غير معروف' };
  if (/mobile|android|iphone|ipad/i.test(ua)) return { icon: 'mobile', label: 'جهاز محمول' };
  return { icon: 'desktop', label: 'حاسوب' };
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
}

export default function SessionsPage() {
  const { user, signOut } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase.from('sessions').select('*')
        .eq('user_id', user.id).is('ended_at', null).order('last_active', { ascending: false });
      if (error) setErr(error.message);
      else setRows((data || []) as SessionRow[]);
      setLoading(false);
    })();
  }, [user]);

  async function endSession(id: string) {
    const { error } = await supabase.from('sessions')
      .update({ ended_at: new Date().toISOString() }).eq('id', id);
    if (!error) setRows(r => r.filter(x => x.id !== id));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)' }}>الجلسات النشطة</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>الأجهزة المتصلة بحسابك</p>
        </div>
        <button onClick={() => signOut()} className="btn btn-secondary h-9 text-xs">
          <LogOut size={13} /> تسجيل الخروج من الكل
        </button>
      </div>

      {err && (
        <div className="card p-3 flex items-start gap-2 text-[11px]" style={{ color: 'var(--danger)' }}>
          <AlertCircle size={14} />{err}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-xs" style={{ color: 'var(--ink-3)' }}>جارٍ التحميل...</div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            <Activity size={22} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>لا توجد جلسات مسجّلة</h3>
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>تتبع الجلسات التفصيلي سيكون متاحاً في التحديث القادم.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const dev = detectDevice(r.user_agent);
            const Icon = dev.icon === 'mobile' ? Smartphone : Monitor;
            return (
              <div key={r.id} className="card p-4 flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{r.device || dev.label}</div>
                  <div className="text-[10.5px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--ink-3)' }}>
                    <span className="inline-flex items-center gap-1"><Globe size={10} />{r.ip_address || '—'}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={10} />{fmt(r.last_active)}</span>
                  </div>
                </div>
                <button onClick={() => endSession(r.id)} className="btn btn-ghost h-8 text-[11px]" style={{ color: 'var(--danger)' }}>
                  <LogOut size={12} /> إنهاء
                </button>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
