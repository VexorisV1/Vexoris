import { motion } from 'framer-motion';
import {
  TrendingUp, ArrowUpRight, Stethoscope, Ambulance,
  FileText, ClipboardCheck, ChevronLeft, Plus, Activity,
  Clock, Target, Users, Zap, Inbox, AlertCircle, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/core/auth';
import { useDashboardData } from './useDashboardData';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  useEffect(() => {
    startRef.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      else setDisplay(value);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);
  return <>{Math.round(display).toLocaleString('en-US')}</>;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `قبل ${diff} ث`;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return `قبل ${Math.floor(diff / 86400)} ي`;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  completed: { label: 'مكتمل', cls: 'pill-success' },
  in_review: { label: 'قيد المراجعة', cls: 'pill-warning' },
  error: { label: 'خطأ', cls: 'pill-danger' },
  pending: { label: 'معلق', cls: 'pill-neutral' },
};

export default function Dashboard() {
  const { profile } = useAuth();
  const name = profile?.display_name || profile?.username || 'مستخدم';
  const [greeting, setGreeting] = useState('');
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardData();

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('صباح الخير');
    else if (h < 17) setGreeting('طاب يومك');
    else setGreeting('مساء الخير');
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full border-[3px] animate-spin mb-3"
            style={{ borderColor: 'var(--line)', borderTopColor: 'var(--primary)' }} />
          <div className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>جارٍ تحميل البيانات...</div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card p-6 text-center max-w-md mx-auto mt-6">
        <AlertCircle size={32} className="mx-auto mb-3" style={{ color: 'var(--danger)' }} />
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>تعذّر تحميل البيانات</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--ink-3)' }}>{(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn btn-primary h-9 px-4">
          <RefreshCw size={13} /> إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data) return null;
  const hasAudits = data.recent_files.length > 0 || data.statuses.total > 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-3 sm:space-y-4">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10.5px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>
            <span>الرئيسية</span><ChevronLeft size={10} />
            <span style={{ color: 'var(--ink)' }}>لوحة التحكم</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--ink)' }}>
            {greeting}، <span className="text-gradient">{name}</span>
          </h1>
          <p className="text-[11px] sm:text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
            {data.kpi.pending_notes > 0
              ? <>لديك <span className="font-bold" style={{ color: 'var(--primary)' }}>{data.kpi.pending_notes}</span> مهمة معلقة اليوم</>
              : 'لا توجد مهام معلقة اليوم'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refetch()} disabled={isFetching} className="btn btn-secondary h-8 text-[11px]">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> تحديث
          </button>
          <Link to="/medical-audit" className="btn btn-primary h-8 text-[11px]">
            <Plus size={13} /> مراجعة جديدة
          </Link>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard label="ملفات مراجعة اليوم" value={data.kpi.audits_today} icon={<Stethoscope size={16} />} accent="var(--primary)" sparkline={data.chart.map(c => c.value)} />
        <KpiCard label="مراجعة طوارئ" value={data.kpi.emergency_today} icon={<Ambulance size={16} />} accent="var(--warning)" sparkline={data.chart.map(c => c.value)} />
        <KpiCard label="ملاحظات معلقة" value={data.kpi.pending_notes} icon={<FileText size={16} />} accent="var(--violet)" sparkline={data.chart.map(c => c.value)} />
        <KpiCard label="دقة المراجعة" value={data.kpi.accuracy} suffix="%" icon={<ClipboardCheck size={16} />} accent="var(--info)" sparkline={data.chart.map(c => c.value)} />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard data={data.chart} />
        <ActivityCard activity={data.activity} />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DepartmentsCard departments={data.departments} hasAudits={hasAudits} />
        <DonutCard statuses={data.statuses} />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <QuickStat label="متوسط الوقت" value={data.quick_stats.avg_time > 0 ? `${data.quick_stats.avg_time} د` : '—'} icon={Clock} accent="var(--info)" />
        <QuickStat label="معدل الدقة" value={`${data.kpi.accuracy}%`} icon={Target} accent="var(--primary)" />
        <QuickStat label="المراجعون" value={String(data.quick_stats.reviewers)} icon={Users} accent="var(--violet)" />
        <QuickStat label="معدل الإنجاز" value={`${data.quick_stats.completion_rate}%`} icon={Zap} accent="var(--warning)" />
      </motion.div>

      <motion.div variants={item} className="card overflow-hidden">
        <div className="px-3 sm:px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>أحدث الملفات</h3>
            <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {data.recent_files.length > 0 ? `آخر ${data.recent_files.length} ملفات` : 'لا توجد ملفات بعد'}
            </p>
          </div>
          <Link to="/medical-audit" className="btn btn-ghost h-7 text-[10.5px]">عرض الكل <ArrowUpRight size={11} /></Link>
        </div>
        {data.recent_files.length === 0 ? (
          <EmptyRow icon={<Inbox size={20} />} label="لا توجد ملفات مسجّلة بعد" />
        ) : (
          <div className="table-scroll">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                  <th className="text-right px-3 sm:px-4 py-2 font-bold text-[10.5px]">رقم الملف</th>
                  <th className="text-right px-3 sm:px-4 py-2 font-bold text-[10.5px]">المريض</th>
                  <th className="text-right px-3 sm:px-4 py-2 font-bold text-[10.5px]">القسم</th>
                  <th className="text-right px-3 sm:px-4 py-2 font-bold text-[10.5px]">المراجع</th>
                  <th className="text-right px-3 sm:px-4 py-2 font-bold text-[10.5px]">الحالة</th>
                  <th className="text-right px-3 sm:px-4 py-2 font-bold text-[10.5px]">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_files.map((r) => {
                  const s = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <tr key={r.file_number} className="border-t transition-colors" style={{ borderColor: 'var(--line)' }}>
                      <td className="px-3 sm:px-4 py-2.5 font-mono font-bold" style={{ color: 'var(--primary)' }}>{r.file_number}</td>
                      <td className="px-3 sm:px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{r.patient}</td>
                      <td className="px-3 sm:px-4 py-2.5" style={{ color: 'var(--ink-2)' }}>{r.department || '—'}</td>
                      <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--ink-2)' }}>{r.reviewer}</td>
                      <td className="px-3 sm:px-4 py-2.5"><span className={`pill ${s.cls}`}>{s.label}</span></td>
                      <td className="px-3 sm:px-4 py-2.5 font-mono" style={{ color: 'var(--ink-3)' }}>{new Date(r.created_at).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function KpiCard({ label, value, suffix, icon, accent, sparkline }: {
  label: string; value: number; suffix?: string; icon: React.ReactNode; accent: string; sparkline: number[];
}) {
  const hasData = sparkline.some(v => v > 0);
  const max = Math.max(1, ...sparkline);
  const points = sparkline.length >= 2
    ? sparkline.map((v, i) => `${(i / (sparkline.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ')
    : '0,100 100,100';
  const safeId = accent.replace(/[^a-z0-9]/gi, '');

  return (
    <div className="card card-hover p-2.5 sm:p-3.5 group relative overflow-hidden h-full">
      <div className="flex items-start justify-between mb-2 sm:mb-3 relative z-10">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6"
          style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent), 0 4px 12px -4px color-mix(in srgb, ${accent} 40%, transparent)` }}>
          {icon}
        </div>
      </div>
      <div className="label mb-0.5 sm:mb-1 relative z-10 text-[9.5px] sm:text-[10.5px]">{label}</div>
      <div className="flex items-end justify-between gap-1 relative z-10">
        <div className="text-lg sm:text-2xl font-bold tabular" style={{ color: 'var(--ink)' }}>
          <AnimatedNumber value={value} />
          {suffix && <span className="text-xs sm:text-lg" style={{ color: 'var(--ink-3)' }}>{suffix}</span>}
        </div>
        {hasData ? (
          <svg width="48" height="20" viewBox="0 0 100 100" preserveAspectRatio="none" className="shrink-0 sm:w-[60px] sm:h-[24px]">
            <defs><linearGradient id={`spark-${safeId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient></defs>
            <polygon points={`0,100 ${points} 100,100`} fill={`url(#spark-${safeId})`} />
            <polyline points={points} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (<span className="text-[10px] font-semibold" style={{ color: 'var(--ink-4)' }}>—</span>)}
      </div>
    </div>
  );
}

function ChartCard({ data }: { data: { date: string; day: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const hasData = data.some(d => d.value > 0);
  return (
    <div className="card p-3 sm:p-4 lg:col-span-2">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>نشاط المراجعة</h3>
          <p className="text-[10.5px] sm:text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
            آخر 7 أيام — {hasData ? `${data.reduce((a, b) => a + b.value, 0)} مراجعة` : 'لا توجد بيانات'}
          </p>
        </div>
      </div>
      <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-48 relative">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="absolute inset-x-0 border-t pointer-events-none"
            style={{ top: `${i * 33}%`, borderColor: 'var(--line)', opacity: 0.5 }} />
        ))}
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 sm:gap-1.5 group relative z-10">
            <div className="w-full relative flex flex-col justify-end" style={{ height: '100%' }}>
              <div className="w-full rounded-t-md transition-all duration-300 group-hover:scale-y-105 group-hover:-translate-y-1"
                style={{
                  height: `${Math.max(2, (d.value / max) * 100)}%`,
                  background: d.value === max && d.value > 0
                    ? 'linear-gradient(180deg, var(--grad-from), var(--grad-to))'
                    : `linear-gradient(180deg, color-mix(in srgb, var(--primary) 35%, transparent), color-mix(in srgb, var(--primary) 15%, transparent))`,
                  transformOrigin: 'bottom', minHeight: '2px',
                }} />
              {d.value > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold whitespace-nowrap opacity-0 group-hover:opacity-100"
                  style={{ background: 'var(--ink)', color: 'var(--surface)' }}>{d.value}</div>
              )}
            </div>
            <span className="text-[9px] sm:text-[10px] font-semibold truncate" style={{ color: 'var(--ink-3)' }}>{d.day.trim()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: { user: string; initial: string; action: string; target: string | null; created_at: string }[] }) {
  const colors = ['var(--primary)', 'var(--info)', 'var(--warning)', 'var(--violet)', 'var(--danger)'];
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>النشاط الأخير</h3>
        <Link to="/workflow" className="text-[10.5px] font-bold" style={{ color: 'var(--primary)' }}>عرض الكل</Link>
      </div>
      {activity.length === 0 ? (
        <div className="py-6 text-center">
          <Activity size={24} className="mx-auto mb-2" style={{ color: 'var(--ink-4)' }} />
          <div className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>لا يوجد نشاط بعد</div>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {activity.map((a, i) => {
            const c = colors[i % colors.length];
            return (
              <div key={i} className="flex items-start gap-2 group cursor-pointer">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 30%, transparent)` }}>
                  {a.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs leading-tight" style={{ color: 'var(--ink-2)' }}>
                    <span className="font-bold" style={{ color: 'var(--ink)' }}>{a.user}</span> {a.action}{' '}
                    {a.target && <span className="font-mono text-[10px] font-bold" style={{ color: c }}>{a.target}</span>}
                  </p>
                  <p className="text-[9.5px] sm:text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--ink-4)' }}>
                    <Clock size={9} /> {timeAgo(a.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DepartmentsCard({ departments, hasAudits }: { departments: { name: string; score: number }[]; hasAudits: boolean }) {
  const colors = ['var(--primary)', 'var(--info)', 'var(--violet)', 'var(--warning)', 'var(--grad-from)'];
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>أداء الأقسام</h3>
        {hasAudits && <span className="pill pill-violet"><TrendingUp size={10} /> مباشر</span>}
      </div>
      {departments.length === 0 ? (
        <EmptyRow icon={<Inbox size={20} />} label="لا توجد أقسام مسجّلة" />
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {departments.map((d, i) => (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] sm:text-xs font-bold truncate" style={{ color: 'var(--ink-2)' }}>{d.name}</span>
                <span className="text-[10.5px] sm:text-[11px] font-mono font-bold tabular" style={{ color: colors[i % colors.length] }}>{d.score}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${d.score}%`, background: `linear-gradient(90deg, ${colors[i % colors.length]}, color-mix(in srgb, ${colors[i % colors.length]} 60%, transparent))` }} />
              </div>
            </div>
          ))}
          {!hasAudits && <div className="text-center text-[10px] pt-1" style={{ color: 'var(--ink-4)' }}>الأداء يظهر بعد تسجيل المراجعات</div>}
        </div>
      )}
    </div>
  );
}

function DonutCard({ statuses }: { statuses: { completed: number; in_review: number; error: number; pending: number; total: number } }) {
  const total = statuses.total;
  const data = [
    { label: 'مكتمل',        value: statuses.completed, color: 'var(--primary)' },
    { label: 'قيد المراجعة', value: statuses.in_review, color: 'var(--warning)' },
    { label: 'خطأ',          value: statuses.error,     color: 'var(--danger)' },
  ];
  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>حالة الملفات</h3>
        <span className="text-[10px] sm:text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>هذا الشهر</span>
      </div>
      {total === 0 ? (
        <EmptyRow icon={<Inbox size={20} />} label="لا توجد ملفات هذا الشهر" />
      ) : (
        <div className="flex items-center gap-4 sm:gap-5">
          <DonutChart data={data} total={total} />
          <div className="flex-1 space-y-2 sm:space-y-2.5 min-w-[110px]">
            {data.map((s) => {
              const pct = Math.round((s.value / total) * 100);
              return (
                <div key={s.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                    <span className="text-[11px] sm:text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{s.label}</span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold tabular" style={{ color: s.color }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DonutChart({ data, total }: { data: { label: string; value: number; color: string }[]; total: number }) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  let acc = 0;
  return (
    <div className="relative w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        {data.map((slice) => {
          if (slice.value === 0) return null;
          const dash = (slice.value / total) * circ;
          const gap = circ - dash;
          const off = -acc;
          acc += dash;
          return (
            <circle key={slice.label} cx="50" cy="50" r={radius} fill="none" stroke={slice.color} strokeWidth="10"
              strokeDasharray={`${dash} ${gap}`} strokeDashoffset={off} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${slice.color})` }} />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base sm:text-xl font-extrabold tabular" style={{ color: 'var(--ink)' }}>
          <AnimatedNumber value={total} duration={1200} />
        </span>
        <span className="text-[8.5px] sm:text-[9.5px] font-bold" style={{ color: 'var(--ink-3)' }}>إجمالي</span>
      </div>
    </div>
  );
}

function QuickStat({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Clock; accent: string }) {
  return (
    <div className="card p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] sm:text-[10.5px] font-semibold truncate" style={{ color: 'var(--ink-3)' }}>{label}</div>
        <div className="text-xs sm:text-sm font-bold tabular" style={{ color: 'var(--ink)' }}>{value}</div>
      </div>
    </div>
  );
}

function EmptyRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto mb-2 inline-flex" style={{ color: 'var(--ink-4)' }}>{icon}</div>
      <div className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>{label}</div>
    </div>
  );
}
