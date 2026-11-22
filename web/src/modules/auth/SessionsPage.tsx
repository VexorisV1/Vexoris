import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Monitor, Smartphone, Tablet, Globe, Clock, LogOut, AlertCircle,
  ShieldCheck, RefreshCw, CalendarClock,
} from 'lucide-react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/auth';
import { fmtNum } from '@/shared/lib/format';

interface SessionRow {
  id: string;
  device_label: string | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_active_at: string;
  is_current: boolean;
}

type DeviceKind = 'desktop' | 'mobile' | 'tablet';

const ICONS = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;
const UNKNOWN_BROWSER = 'متصفح غير معروف';
const UNKNOWN_OS = 'نظام غير معروف';

function parseUA(ua: string | null): { kind: DeviceKind; browser: string; os: string } {
  if (!ua) return { kind: 'desktop', browser: UNKNOWN_BROWSER, os: UNKNOWN_OS };

  const os =
    /windows/i.test(ua) ? 'Windows' :
    /android/i.test(ua) ? 'Android' :
    /iphone|ipad|ipod/i.test(ua) ? 'iOS' :
    /mac os x|macintosh/i.test(ua) ? 'macOS' :
    /linux/i.test(ua) ? 'Linux' : UNKNOWN_OS;

  const browser =
    /edg\//i.test(ua) ? 'Edge' :
    /opr\/|opera/i.test(ua) ? 'Opera' :
    /firefox|fxios/i.test(ua) ? 'Firefox' :
    /chrome|crios/i.test(ua) ? 'Chrome' :
    /safari/i.test(ua) ? 'Safari' : UNKNOWN_BROWSER;

  const kind: DeviceKind =
    /ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? 'tablet' :
    /mobile|iphone|ipod|android/i.test(ua) ? 'mobile' : 'desktop';

  return { kind, browser, os };
}

const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });

function ago(dt: string): string {
  const diff = Math.round((new Date(dt).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return 'الآن';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

const fmtFull = (dt: string) =>
  new Date(dt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

const isOnline = (dt: string) => Date.now() - new Date(dt).getTime() < 5 * 60 * 1000;

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>
        {icon}{label}
      </dt>
      <dd className="text-[13px] font-bold truncate tabular" style={{ color: 'var(--ink)' }} dir="auto">{value}</dd>
    </div>
  );
}

export default function SessionsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState<string | 'all' | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErr('');
    const { data, error } = await supabase.rpc('get_my_sessions');
    if (error) setErr(error.message);
    else setRows((data || []) as SessionRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const current = useMemo(() => rows.find((r) => r.is_current) ?? null, [rows]);
  const others = useMemo(
    () => rows
      .filter((r) => !r.is_current)
      .sort((a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()),
    [rows],
  );

  async function endSession(id: string) {
    setBusy(id);
    setErr('');
    const { error } = await supabase.rpc('kill_session', { p_session_id: id });
    if (error) setErr(error.message);
    else setRows((r) => r.filter((x) => x.id !== id));
    setConfirmId(null);
    setBusy(null);
  }

  async function endAllOthers() {
    setBusy('all');
    setErr('');
    const results = await Promise.all(
      others.map((s) => supabase.rpc('kill_session', { p_session_id: s.id })),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) setErr(failed.error.message);
    await load();
    setConfirmAll(false);
    setBusy(null);
  }

  const cur = current ? parseUA(current.user_agent) : null;
  const CurIcon = cur ? ICONS[cur.kind] : Monitor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5 max-w-4xl"
    >
      {/* العنوان */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)' }}>الجلسات النشطة</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
            {loading
              ? 'جارٍ تحميل الأجهزة المتصلة بحسابك'
              : `${fmtNum(rows.length)} جلسة مسجّلة على حسابك`}
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn btn-secondary h-9 text-xs">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {err && (
        <div
          className="card p-3 flex items-start gap-2 text-[11.5px]"
          style={{ color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
          role="alert"
        >
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="font-semibold break-words">{err}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="card h-40 animate-pulse" />
          <div className="card h-20 animate-pulse" />
          <div className="card h-20 animate-pulse" />
        </div>
      ) : rows.length === 0 && !err ? (
        <div className="card p-10 text-center">
          <div
            className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
          >
            <ShieldCheck size={22} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>لا توجد جلسات مسجّلة بعد</h3>
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
            يُسجَّل جهازك الحالي هنا عند أول تحقق بعد تسجيل الدخول.
          </p>
        </div>
      ) : (
        <>
          {/* الجلسة الحالية */}
          {current && cur && (
            <section className="card p-5 sm:p-6 relative overflow-hidden">
              <div
                className="absolute top-0 right-0 left-0 h-px pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', opacity: 0.6 }}
              />
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))',
                    color: '#fff',
                    boxShadow: '0 6px 18px -6px var(--primary-glow)',
                  }}
                >
                  <CurIcon size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold mb-0.5" style={{ color: 'var(--primary)' }}>هذا الجهاز</div>
                  <h2 className="text-base font-bold truncate" style={{ color: 'var(--ink)' }}>
                    {current.device_label || `${cur.browser} على ${cur.os}`}
                  </h2>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: 'rgba(8,145,178,0.10)', color: 'var(--success)' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                  نشطة الآن
                </span>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <Detail icon={<Globe size={12} />} label="المتصفح" value={`${cur.browser} · ${cur.os}`} />
                <Detail icon={<Globe size={12} />} label="عنوان IP" value={current.ip_address || '—'} />
                <Detail icon={<CalendarClock size={12} />} label="بدأت في" value={fmtFull(current.created_at)} />
                <Detail icon={<Clock size={12} />} label="آخر نشاط" value={ago(current.last_active_at)} />
              </dl>
            </section>
          )}

          {/* الجلسات الأخرى */}
          <section>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5">
              <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                الأجهزة الأخرى {others.length > 0 && <span style={{ color: 'var(--ink-3)' }}>({fmtNum(others.length)})</span>}
              </h2>

              {others.length > 0 && (confirmAll ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                    إنهاء {fmtNum(others.length)} جلسة؟
                  </span>
                  <button
                    type="button" onClick={() => void endAllOthers()} disabled={busy === 'all'}
                    className="btn h-8 text-[11px] text-white" style={{ background: 'var(--danger)' }}
                  >
                    {busy === 'all' ? 'جارٍ الإنهاء...' : 'تأكيد'}
                  </button>
                  <button type="button" onClick={() => setConfirmAll(false)} className="btn btn-ghost h-8 text-[11px]">
                    إلغاء
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmAll(true)} className="btn btn-secondary h-8 text-[11.5px]">
                  <LogOut size={12} /> إنهاء كل الجلسات الأخرى
                </button>
              ))}
            </div>

            {others.length === 0 ? (
              <div className="card p-6 text-center text-xs" style={{ color: 'var(--ink-3)' }}>
                لا توجد جلسات أخرى. حسابك مفتوح على هذا الجهاز فقط.
              </div>
            ) : (
              <ul className="card p-0 overflow-hidden">
                {others.map((r, i) => {
                  const d = parseUA(r.user_agent);
                  const Icon = ICONS[d.kind];
                  const online = isOnline(r.last_active_at);
                  const confirming = confirmId === r.id;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 p-4 flex-wrap sm:flex-nowrap"
                      style={i > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
                      >
                        <Icon size={18} />
                        {online && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                            style={{ background: 'var(--success)', boxShadow: '0 0 0 2px var(--surface)' }}
                            title="نشطة الآن"
                          />
                        )}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate" style={{ color: 'var(--ink)' }}>
                          {r.device_label || `${d.browser} على ${d.os}`}
                        </div>
                        <div className="mt-0.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px]" style={{ color: 'var(--ink-3)' }}>
                          <span className="inline-flex items-center gap-1 tabular" dir="ltr">
                            <Globe size={10} />{r.ip_address || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1" title={fmtFull(r.last_active_at)}>
                            <Clock size={10} />آخر نشاط {ago(r.last_active_at)}
                          </span>
                        </div>
                      </div>

                      {confirming ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button" onClick={() => void endSession(r.id)} disabled={busy === r.id}
                            className="btn h-8 text-[11px] text-white" style={{ background: 'var(--danger)' }}
                          >
                            {busy === r.id ? 'جارٍ...' : 'تأكيد الإنهاء'}
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="btn btn-ghost h-8 text-[11px]">
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button" onClick={() => setConfirmId(r.id)}
                          className="btn btn-ghost h-8 text-[11px] shrink-0" style={{ color: 'var(--danger)' }}
                        >
                          <LogOut size={12} /> إنهاء
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            لا تتعرّف على جلسة؟ أنهِها فوراً ثم <Link to="/change-password" className="font-bold" style={{ color: 'var(--primary)' }}>غيّر كلمة المرور</Link>.
          </p>
        </>
      )}
    </motion.div>
  );
}
