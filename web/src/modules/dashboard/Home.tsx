import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Shield, BarChart3, Activity, Stethoscope,
  Lock, Zap, Sparkles, TrendingUp
} from 'lucide-react';
import { LogoMark } from '@/shared/components/Logo';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function Home() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-10 max-w-5xl mx-auto"
    >
      {/* Hero */}
      <motion.section variants={item} className="pt-4">
        <div
          className="inline-flex items-center gap-2 h-7 px-2.5 rounded-full border text-[10.5px] font-bold mb-6"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--line)',
            color: 'var(--ink-3)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
          <Sparkles size={11} style={{ color: 'var(--primary)' }} />
          Aurora Obsidian — الإصدار الثالث
        </div>

        <div className="flex items-start gap-4 mb-6">
          <LogoMark size={64} />
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-2" style={{ color: 'var(--ink)' }}>
              <span className="text-gradient">VEXORIS</span>
            </h1>
            <p className="text-lg font-bold" style={{ color: 'var(--ink-3)' }}>
              نظام إدارة السجلات الطبية والمراجعة
            </p>
          </div>
        </div>

        <p className="text-md font-medium leading-relaxed max-w-2xl mb-8" style={{ color: 'var(--ink-2)' }}>
          منصة ERP متكاملة لمراجعة الملفات الطبية، تدقيق نماذج الطوارئ، وتحليل المؤشرات الإحصائية — بأمان مؤسسي وصلاحيات متعددة الأدوار.
        </p>

        <div className="flex items-center gap-2">
          <Link to="/login" className="btn btn-primary h-10 px-5 text-sm group">
            ابدأ الآن
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          </Link>
          <Link to="/about" className="btn btn-secondary h-10 px-5 text-sm">
            عن النظام
          </Link>
        </div>
      </motion.section>

      {/* Metrics strip */}
      <motion.section
        variants={item}
        className="grid grid-cols-2 md:grid-cols-4 gap-2"
      >
        {[
          { label: 'ملف طبي', value: '12,847', trend: '+8.2%', icon: Activity,     accent: 'var(--primary)' },
          { label: 'مراجعة يومية', value: '856', trend: '+3.1%', icon: BarChart3,   accent: '#0284c7' },
          { label: 'مستخدم نشط', value: '142',  trend: '+12',   icon: Shield,      accent: '#7c3aed' },
          { label: 'دقة المراجعة', value: '99.2%', trend: '+0.4%', icon: TrendingUp, accent: '#0d9488' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="card p-4 group cursor-default"
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{
                  background: `color-mix(in srgb, ${s.accent} 12%, transparent)`,
                  color: s.accent,
                }}
              >
                <s.icon size={14} />
              </div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--primary)' }}>{s.trend}</span>
            </div>
            <div className="label mb-0.5">{s.label}</div>
            <div className="text-xl font-bold tabular" style={{ color: 'var(--ink)' }}>{s.value}</div>
          </div>
        ))}
      </motion.section>

      {/* Features with color variety */}
      <motion.section variants={item}>
        <div className="mb-5">
          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--ink)' }}>قدرات المنصة</h2>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>مبنية لتناسب المستشفيات والمراكز الطبية الكبرى</p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {[
            { icon: Stethoscope, title: 'مراجعة طبية متقدمة', desc: 'تدقيق النماذج الطبية طبقاً لتعليمات الجودة المعتمدة', accent: 'var(--primary)' },
            { icon: BarChart3,   title: 'تحليلات فورية',      desc: 'مؤشرات لحظية وتقارير تفاعلية دقيقة',                  accent: '#0284c7' },
            { icon: Lock,        title: 'أمان مؤسسي',         desc: 'تشفير كامل + Row Level Security على مستوى القاعدة',   accent: '#7c3aed' },
            { icon: Zap,         title: 'أداء عالي',          desc: 'استعلامات محسّنة + Materialized Views للتقارير',       accent: '#d97706' },
          ].map((f) => (
            <div key={f.title} className="card card-hover p-4 group">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3
                           transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{
                  background: `color-mix(in srgb, ${f.accent} 12%, transparent)`,
                  color: f.accent,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${f.accent} 25%, transparent)`,
                }}
              >
                <f.icon size={18} />
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-3)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
