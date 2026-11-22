import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, FileText,
  Stethoscope, BarChart3, Lock, Zap,
} from 'lucide-react';
import { LogoMark } from '@/shared/components/Logo';
import { useAuth } from '@/core/auth';
import { ROLE_META } from '@/shared/lib/roles';

/* مثال توضيحي لمراجعة ملف — ليس بيانات حقيقية */
const SAMPLE_CHECKS = [
  { ok: true,  text: 'تاريخا الدخول والخروج مسجّلان' },
  { ok: true,  text: 'ملاحظات الطبيب موقّعة ومؤرّخة' },
  { ok: false, text: 'نموذج الطوارئ ينقصه توقيع المراجع' },
  { ok: true,  text: 'التشخيص مطابق لتعليمات الجودة' },
];

const FEATURES = [
  {
    icon: Stethoscope,
    title: 'مراجعة الملفات الطبية',
    desc: 'تدقيق كل ملف وفق تعليمات الجودة المعتمدة، وتسجيل الملاحظات على مستوى النموذج.',
    accent: 'var(--primary)',
  },
  {
    icon: BarChart3,
    title: 'مؤشرات الجودة',
    desc: 'نسب الالتزام، والاتجاه الشهري، ونشاط المراجعين، محسوبة مباشرة من بيانات المراجعة.',
    accent: 'var(--info)',
  },
  {
    icon: Lock,
    title: 'أمان على مستوى القاعدة',
    desc: 'تحقق ثنائي للأدوار الإدارية، وسياسات Row Level Security تمنع أي دور من رؤية ما لا يخصه.',
    accent: 'var(--violet)',
  },
  {
    icon: Zap,
    title: 'تقارير سريعة',
    desc: 'استعلامات محسّنة وMaterialized Views تُبقي لوحة التحكم سريعة مع حجم بيانات كبير.',
    accent: 'var(--warning)',
  },
];

export default function Home() {
  const { user } = useAuth();
  const ctaTo = user ? '/dashboard' : '/login';
  const ctaLabel = user ? 'الذهاب إلى لوحة التحكم' : 'تسجيل الدخول';

  const passed = SAMPLE_CHECKS.filter((c) => c.ok).length;
  const score = Math.round((passed / SAMPLE_CHECKS.length) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-20 pb-6">
      {/* ───────── Hero ───────── */}
      <section className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center pt-4">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <LogoMark size={44} />
            <span className="text-lg font-extrabold tracking-wide text-gradient">VEXORIS</span>
          </div>

          <h1 className="text-3xl md:text-[2.6rem] font-extrabold leading-[1.25] mb-4" style={{ color: 'var(--ink)' }}>
            مراجعة الملفات الطبية،
            <br />
            بدقة يمكن قياسها
          </h1>

          <p className="text-md font-medium leading-relaxed max-w-xl mb-8" style={{ color: 'var(--ink-2)' }}>
            نظام واحد لمراجعة الملفات وتدقيق نماذج الطوارئ ومتابعة مؤشرات الجودة،
            بصلاحيات واضحة لكل دور داخل المستشفى.
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <Link to={ctaTo} className="btn btn-primary h-10 px-5 text-sm group">
              {ctaLabel}
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
            </Link>
            <Link to="/about" className="btn btn-secondary h-10 px-5 text-sm">
              تعرّف على النظام
            </Link>
          </div>
        </div>

        {/* معاينة مراجعة ملف */}
        <div className="card p-0 overflow-hidden" aria-label="مثال توضيحي لمراجعة ملف طبي">
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                <FileText size={14} />
              </span>
              <span className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>مراجعة ملف طبي</span>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
              style={{ background: 'var(--surface-3)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}
            >
              مثال توضيحي
            </span>
          </div>

          <ul className="p-2">
            {SAMPLE_CHECKS.map((c, i) => (
              <motion.li
                key={c.text}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[12.5px] font-semibold"
                style={{ color: 'var(--ink-2)' }}
              >
                {c.ok ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} className="shrink-0" />
                ) : (
                  <AlertTriangle size={16} style={{ color: 'var(--warning)' }} className="shrink-0" />
                )}
                <span className="flex-1">{c.text}</span>
                {!c.ok && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(217,119,6,0.12)', color: 'var(--warning)' }}
                  >
                    يحتاج مراجعة
                  </span>
                )}
              </motion.li>
            ))}
          </ul>

          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
              <span style={{ color: 'var(--ink-3)' }}>اكتمال الملف</span>
              <span className="tabular" style={{ color: 'var(--ink)' }}>{score.toLocaleString('ar-EG')}٪</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, var(--grad-from), var(--grad-to))' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── ما يغطيه النظام ───────── */}
      <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8">
        <div className="lg:sticky lg:top-28 self-start">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>ما يغطيه النظام</h2>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--ink-3)' }}>
            مبني حول عمل مكتب المراجعة الطبية اليومي، من فتح الملف حتى قراءة المؤشرات.
          </p>
        </div>

        <ul className="card p-0 overflow-hidden">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="flex items-start gap-4 p-5"
              style={i > 0 ? { borderTop: '1px solid var(--line)' } : undefined}
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `color-mix(in srgb, ${f.accent} 12%, transparent)`,
                  color: f.accent,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${f.accent} 25%, transparent)`,
                }}
              >
                <f.icon size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-3)' }}>{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ───────── الأدوار ───────── */}
      <section>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>ثمانية أدوار، ولكل دور حدوده</h2>
        <p className="text-sm leading-relaxed max-w-xl mb-6" style={{ color: 'var(--ink-3)' }}>
          من المطوّر إلى المراجع، يرى كل مستخدم الوحدات التي تخص دوره فقط.
        </p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROLE_META).map(([key, r]) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-xs font-bold border"
              style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
          ))}
        </div>
      </section>

      {/* ───────── دعوة ختامية ───────── */}
      <section
        className="card p-6 sm:p-8 flex items-center justify-between gap-5 flex-wrap relative overflow-hidden"
      >
        <div
          className="absolute top-0 right-0 left-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', opacity: 0.6 }}
        />
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>جاهز للبدء؟</h2>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            الحسابات يُنشئها مسؤول النظام، فسجّل الدخول بالبيانات التي وصلتك.
          </p>
        </div>
        <Link to={ctaTo} className="btn btn-primary h-10 px-5 text-sm group">
          {ctaLabel}
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
        </Link>
      </section>
    </div>
  );
}
