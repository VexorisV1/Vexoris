import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ArrowUpRight, Stethoscope, Ambulance,
  FileText, ClipboardCheck, ChevronLeft, Plus, Activity,
  Clock, Target, Users, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/core/auth';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(value * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      else setDisplay(value);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display.toLocaleString('en-US')}</>;
}

function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (window.innerWidth < 1024) return; // disable 3D tilt on mobile/tablet
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
      '--mouse-x': `${x}px`,
      '--mouse-y': `${y}px`,
    } as React.CSSProperties);
  }

  function handleLeave() {
    setStyle({ transform: 'perspective(1000px) rotateX(0) rotateY(0) scale(1)' });
  }

  return (
    <div ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave}
      style={{ ...style, transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)' }}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const name = profile?.display_name || profile?.username || 'مستخدم';
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('صباح الخير');
    else if (hour < 17) setGreeting('طاب يومك');
    else setGreeting('مساء الخير');
  }, []);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-3 sm:space-y-4">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10.5px] font-semibold mb-1" style={{ color: 'var(--ink-3)' }}>
            <span>الرئيسية</span>
            <ChevronLeft size={10} />
            <span style={{ color: 'var(--ink)' }}>لوحة التحكم</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--ink)' }}>
            {greeting}،
            <span className="text-gradient">{name}</span>
            <motion.span
              animate={{ rotate: [0, 15, -10, 15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 4 }}
              className="inline-block"
            >👋</motion.span>
          </h1>
          <p className="text-[11px] sm:text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
            لديك <span className="font-bold" style={{ color: 'var(--primary)' }}>24 مهمة</span> تحتاج مراجعتك اليوم
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button className="btn btn-secondary h-8 text-[11px] flex-1 sm:flex-none">
            <Plus size={13} /> مراجعة
          </button>
          <button className="btn btn-primary h-8 text-[11px] flex-1 sm:flex-none">
            <ClipboardCheck size={13} /> تقرير
          </button>
        </div>
      </motion.div>

      {/* KPI cards — 2 cols mobile */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <TiltCard>
          <KpiCard
            label="ملفات اليوم"
            value={142} trend="+18.2%" direction="up"
            icon={<Stethoscope size={16} />}
            accent="var(--primary)"
            sparkline={[20, 35, 28, 45, 38, 52, 48, 62, 55, 70]}
          />
        </TiltCard>
        <TiltCard>
          <KpiCard
            label="طوارئ"
            value={38} trend="+5.4%" direction="up"
            icon={<Ambulance size={16} />}
            accent="var(--warning)"
            sparkline={[10, 15, 12, 20, 18, 22, 28, 25, 30, 34]}
          />
        </TiltCard>
        <TiltCard>
          <KpiCard
            label="معلقة"
            value={7} trend="-12.5%" direction="down"
            icon={<FileText size={16} />}
            accent="var(--violet)"
            sparkline={[20, 18, 15, 14, 12, 10, 11, 9, 8, 7]}
          />
        </TiltCard>
        <TiltCard>
          <KpiCard
            label="الدقة"
            value={99} suffix=".2%" trend="+0.4%" direction="up"
            icon={<ClipboardCheck size={16} />}
            accent="var(--info)"
            sparkline={[95, 96, 97, 97, 98, 98, 99, 99, 99, 99]}
          />
        </TiltCard>
      </motion.div>

      {/* Chart + Activity */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="card p-3 sm:p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>نشاط المراجعة</h3>
              <p className="text-[10.5px] sm:text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                آخر 7 أيام — <span style={{ color: 'var(--primary)' }}>+12.4%</span>
              </p>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
              {['7 أيام', '30 يوم', 'سنة'].map((t, i) => (
                <button key={t}
                  className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-[10.5px] font-bold transition-colors"
                  style={{
                    background: i === 0 ? 'var(--surface)' : 'transparent',
                    color: i === 0 ? 'var(--ink)' : 'var(--ink-3)',
                    boxShadow: i === 0 ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-48 relative">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="absolute inset-x-0 border-t pointer-events-none"
                style={{ top: `${i * 33}%`, borderColor: 'var(--line)', opacity: 0.5 }} />
            ))}
            {[
              { day: 'السبت',   value: 62 },
              { day: 'الأحد',   value: 78 },
              { day: 'الإثنين', value: 55 },
              { day: 'الثلاثاء', value: 88 },
              { day: 'الأربعاء', value: 72 },
              { day: 'الخميس',  value: 95 },
              { day: 'الجمعة',  value: 40 },
            ].map((d, i) => (
              <motion.div key={d.day}
                initial={{ height: 0 }}
                animate={{ height: `${d.value * (window.innerWidth < 640 ? 1.0 : 1.6)}px` }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex flex-col items-center gap-1 sm:gap-1.5 group relative z-10">
                <div className="w-full relative">
                  <motion.div
                    className="w-full rounded-t-md cursor-pointer"
                    whileHover={{ scaleY: 1.05, y: -2 }}
                    style={{
                      height: `${d.value * (window.innerWidth < 640 ? 1.0 : 1.6)}px`,
                      background: i === 5
                        ? 'linear-gradient(180deg, var(--grad-from), var(--grad-to))'
                        : `linear-gradient(180deg, color-mix(in srgb, var(--primary) 35%, transparent), color-mix(in srgb, var(--primary) 15%, transparent))`,
                      boxShadow: i === 5 ? '0 -4px 14px -2px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.2)' : 'none',
                      transformOrigin: 'bottom',
                    }}
                  />
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md
                                  text-[9px] sm:text-[10px] font-mono font-bold whitespace-nowrap
                                  opacity-0 group-hover:opacity-100 transition-all duration-200
                                  group-hover:-top-8"
                    style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
                    {d.value}
                  </div>
                </div>
                <span className="text-[9px] sm:text-[10px] font-semibold truncate" style={{ color: 'var(--ink-3)' }}>
                  {d.day}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>النشاط الأخير</h3>
            <Link to="/workflow" className="text-[10.5px] font-bold" style={{ color: 'var(--primary)' }}>
              عرض الكل
            </Link>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {[
              { user: 'د. أحمد',  action: 'راجع ملف',     target: '#MR-2847', time: 'قبل 3 د',  color: 'var(--primary)', initial: 'أ' },
              { user: 'أ. سارة',  action: 'أضاف ملاحظة', target: '#MR-2845', time: 'قبل 12 د', color: 'var(--info)',    initial: 'س' },
              { user: 'د. محمد',  action: 'رفع طوارئ',   target: '#ER-118',  time: 'قبل 28 د', color: 'var(--warning)', initial: 'م' },
              { user: 'أ. فاطمة', action: 'أنشأت تقرير', target: 'شهري',     time: 'قبل 45 د', color: 'var(--violet)',  initial: 'ف' },
              { user: 'د. عمر',   action: 'صحح خطأ',     target: '#MR-2840', time: 'قبل 1 س',  color: 'var(--danger)',  initial: 'ع' },
            ].map((a, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.06 }}
                className="flex items-start gap-2 group cursor-pointer">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold shrink-0 transition-transform group-hover:scale-110"
                  style={{
                    background: `color-mix(in srgb, ${a.color} 18%, transparent)`,
                    color: a.color,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${a.color} 30%, transparent)`,
                  }}>
                  {a.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-xs leading-tight" style={{ color: 'var(--ink-2)' }}>
                    <span className="font-bold" style={{ color: 'var(--ink)' }}>{a.user}</span>
                    {' '}{a.action}{' '}
                    <span className="font-mono text-[10px] sm:text-[10.5px] font-bold" style={{ color: a.color }}>
                      {a.target}
                    </span>
                  </p>
                  <p className="text-[9.5px] sm:text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--ink-4)' }}>
                    <Clock size={9} /> {a.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Departments + Donut */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>أداء الأقسام</h3>
            <span className="pill pill-violet">
              <TrendingUp size={10} /> ممتاز
            </span>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {[
              { name: 'الباطنة',  value: 92, color: 'var(--primary)' },
              { name: 'القلب',    value: 78, color: 'var(--info)' },
              { name: 'الجراحة',  value: 85, color: 'var(--violet)' },
              { name: 'الطوارئ',  value: 64, color: 'var(--warning)' },
              { name: 'الأطفال',  value: 71, color: 'var(--grad-from)' },
            ].map((d, i) => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold" style={{ color: 'var(--ink-2)' }}>{d.name}</span>
                  <span className="text-[10.5px] sm:text-[11px] font-mono font-bold tabular" style={{ color: d.color }}>{d.value}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${d.value}%` }}
                    transition={{ delay: 0.5 + i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${d.color}, color-mix(in srgb, ${d.color} 60%, transparent))`,
                      boxShadow: `0 0 8px color-mix(in srgb, ${d.color} 40%, transparent)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>حالة الملفات</h3>
            <span className="text-[10px] sm:text-[10.5px] font-semibold" style={{ color: 'var(--ink-3)' }}>هذا الشهر</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-5">
            <DonutChart
              data={[
                { label: 'مكتمل',        value: 68, color: 'var(--primary)' },
                { label: 'قيد المراجعة', value: 22, color: 'var(--warning)' },
                { label: 'خطأ',          value: 10, color: 'var(--danger)' },
              ]}
            />
            <div className="flex-1 space-y-2 sm:space-y-2.5 min-w-[110px]">
              {[
                { label: 'مكتمل',        value: 68, color: 'var(--primary)' },
                { label: 'قيد المراجعة', value: 22, color: 'var(--warning)' },
                { label: 'خطأ',          value: 10, color: 'var(--danger)' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                    <span className="text-[11px] sm:text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>{s.label}</span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold tabular" style={{ color: s.color }}>{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick stats */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'متوسط الوقت', value: '4.2 د', icon: Clock,  accent: 'var(--info)' },
          { label: 'معدل الدقة',  value: '99.2%', icon: Target, accent: 'var(--primary)' },
          { label: 'المراجعون',   value: '14',    icon: Users,  accent: 'var(--violet)' },
          { label: 'معدل الإنجاز',value: '92%',   icon: Zap,    accent: 'var(--warning)' },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.06 }}
            className="card p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: `color-mix(in srgb, ${s.accent} 14%, transparent)`,
                color: s.accent,
              }}>
              <s.icon size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[10.5px] font-semibold truncate" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="text-xs sm:text-sm font-bold tabular" style={{ color: 'var(--ink)' }}>{s.value}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent table — scrollable on mobile */}
      <motion.div variants={item} className="card overflow-hidden">
        <div className="px-3 sm:px-4 py-3 flex items-center justify-between border-b"
             style={{ borderColor: 'var(--line)' }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>أحدث الملفات</h3>
            <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>آخر 5 ملفات</p>
          </div>
          <Link to="/medical-audit" className="btn btn-ghost h-7 text-[10.5px]">
            عرض الكل <ArrowUpRight size={11} />
          </Link>
        </div>

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
              {[
                { id: 'MR-2847', patient: 'عبدالله السالم', dept: 'باطنة',  reviewer: 'د. أحمد',  status: 'success', label: 'مكتمل',        date: '18/11' },
                { id: 'MR-2846', patient: 'منى العتيبي',   dept: 'قلب',     reviewer: 'د. محمد',  status: 'warning', label: 'قيد المراجعة', date: '18/11' },
                { id: 'MR-2845', patient: 'خالد الرشيد',  dept: 'جراحة',   reviewer: 'أ. سارة', status: 'success', label: 'مكتمل',        date: '18/11' },
                { id: 'MR-2844', patient: 'نورة الفيصل',  dept: 'أطفال',   reviewer: 'د. عمر',   status: 'danger',  label: 'خطأ',          date: '17/11' },
                { id: 'MR-2843', patient: 'سلطان الحربي', dept: 'طوارئ',   reviewer: 'د. أحمد',  status: 'success', label: 'مكتمل',        date: '17/11' },
              ].map((r) => (
                <tr key={r.id} className="border-t transition-colors"
                    style={{ borderColor: 'var(--line)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td className="px-3 sm:px-4 py-2.5 font-mono font-bold" style={{ color: 'var(--primary)' }}>{r.id}</td>
                  <td className="px-3 sm:px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: 'var(--ink)' }}>{r.patient}</td>
                  <td className="px-3 sm:px-4 py-2.5" style={{ color: 'var(--ink-2)' }}>{r.dept}</td>
                  <td className="px-3 sm:px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--ink-2)' }}>{r.reviewer}</td>
                  <td className="px-3 sm:px-4 py-2.5">
                    <span className={`pill pill-${r.status}`}>{r.label}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-2.5 font-mono" style={{ color: 'var(--ink-3)' }}>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

function KpiCard({
  label, value, suffix, trend, direction, icon, accent, sparkline,
}: {
  label: string;
  value: number;
  suffix?: string;
  trend: string;
  direction: 'up' | 'down';
  icon: React.ReactNode;
  accent: string;
  sparkline: number[];
}) {
  const max = Math.max(...sparkline);
  const min = Math.min(...sparkline);
  const range = max - min || 1;
  const points = sparkline
    .map((v, i) => {
      const x = (i / (sparkline.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const trendColor = direction === 'up' ? 'var(--primary)' : 'var(--danger)';
  const safeId = accent.replace(/[^a-z0-9]/gi, '');

  return (
    <div
      className="card card-hover p-2.5 sm:p-3.5 group relative overflow-hidden h-full"
      style={{
        background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
          color-mix(in srgb, ${accent} 8%, var(--surface)) 0%,
          var(--surface) 40%)`,
      }}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3 relative z-10">
        <div
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6"
          style={{
            background: `color-mix(in srgb, ${accent} 15%, transparent)`,
            color: accent,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent), 0 4px 12px -4px color-mix(in srgb, ${accent} 40%, transparent)`,
          }}
        >
          {icon}
        </div>
        <div className="flex items-center gap-0.5 text-[9.5px] sm:text-[10.5px] font-bold" style={{ color: trendColor }}>
          {direction === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {trend}
        </div>
      </div>

      <div className="label mb-0.5 sm:mb-1 relative z-10 text-[9.5px] sm:text-[10.5px]">{label}</div>
      <div className="flex items-end justify-between gap-1 relative z-10">
        <div className="text-lg sm:text-2xl font-bold tabular" style={{ color: 'var(--ink)' }}>
          <AnimatedNumber value={value} />
          {suffix && <span className="text-xs sm:text-lg" style={{ color: 'var(--ink-3)' }}>{suffix}</span>}
        </div>
        <svg width="48" height="20" viewBox="0 0 100 100" preserveAspectRatio="none" className="shrink-0 sm:w-[60px] sm:h-[24px]">
          <defs>
            <linearGradient id={`spark-${safeId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,100 ${points} 100,100`} fill={`url(#spark-${safeId})`} />
          <polyline
            points={points}
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="relative w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        {data.map((slice, i) => {
          const dash = (slice.value / total) * circumference;
          const gap = circumference - dash;
          const offset = -accumulated;
          accumulated += dash;
          return (
            <motion.circle
              key={slice.label}
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="10"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${dash} ${gap}` }}
              transition={{ delay: 0.5 + i * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: `drop-shadow(0 0 3px ${slice.color})` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base sm:text-xl font-extrabold tabular" style={{ color: 'var(--ink)' }}>
          <AnimatedNumber value={total} duration={1400} />
        </span>
        <span className="text-[8.5px] sm:text-[9.5px] font-bold" style={{ color: 'var(--ink-3)' }}>إجمالي</span>
      </div>
    </div>
  );
}
