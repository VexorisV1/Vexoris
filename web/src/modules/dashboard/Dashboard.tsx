import { motion } from 'framer-motion';
import {
  TrendingUp, Activity, FileText, Stethoscope, Users, ClipboardCheck,
  BarChart3, Award, Calendar, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useOverviewStats, useMonthlyTrend, useQualityKpis } from '@/hooks/useDashboard';
import { fmtNum, fmtPct, fmtMonth } from '@/shared/lib/format';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <motion.div {...fadeUp} className="card p-4 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 left-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }}
      />
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--ink)' }}>
        {value}
      </div>
      <div className="text-[11px] font-semibold mt-1" style={{ color: 'var(--ink-3)' }}>
        {label}
      </div>
      {sub && (
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--ink-4)' }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="w-9 h-9 rounded-xl mb-3" style={{ background: 'var(--surface-2)' }} />
      <div className="h-6 w-20 rounded mb-2" style={{ background: 'var(--surface-2)' }} />
      <div className="h-3 w-24 rounded" style={{ background: 'var(--surface-2)' }} />
    </div>
  );
}

export default function Dashboard() {
  const overview = useOverviewStats();
  const trend = useMonthlyTrend();
  const quality = useQualityKpis();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>
          لوحة التحكم
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
          نظرة شاملة على أداء النظام والجودة
        </p>
      </div>

      {/* KPI Cards — Overview */}
      <div>
        <h2 className="text-xs font-bold mb-2.5" style={{ color: 'var(--ink-3)' }}>
          الإحصائيات العامة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {overview.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : overview.isError ? (
            <div className="col-span-2 md:col-span-4 card p-4 flex items-center gap-2 text-xs"
              style={{ color: 'var(--danger)' }}>
              <AlertCircle size={14} />
              تعذّر تحميل الإحصائيات — جرّب إعادة التحميل
            </div>
          ) : (
            <>
              <KpiCard
                label="نسبة الجودة العامة"
                value={fmtPct(overview.data?.overall_pct)}
                icon={TrendingUp}
                color="#0ea5e9"
              />
              <KpiCard
                label="إجمالي الوحدات"
                value={fmtNum(overview.data?.total_units)}
                icon={Activity}
                color="#6366f1"
              />
              <KpiCard
                label="النماذج النشطة"
                value={fmtNum(overview.data?.total_forms)}
                icon={FileText}
                color="#8b5cf6"
              />
              <KpiCard
                label="إجمالي المراجعات"
                value={fmtNum(overview.data?.total_reviews)}
                icon={ClipboardCheck}
                color="#10b981"
              />
            </>
          )}
        </div>
      </div>

      {/* Secondary KPIs */}
      {!overview.isLoading && overview.data && (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="الأطباء" value={fmtNum(overview.data.total_doctors)} icon={Stethoscope} color="#06b6d4" />
          <KpiCard label="التمريض" value={fmtNum(overview.data.total_nurses)} icon={Users} color="#f59e0b" />
          <KpiCard label="الكتّاب" value={fmtNum(overview.data.total_clerks)} icon={Users} color="#a855f7" />
        </div>
      )}

      {/* Monthly Trend */}
      <motion.div {...fadeUp} className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
              الاتجاه الشهري
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              عدد المراجعات ونسبة الجودة عبر 12 شهر
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink-3)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
              الجودة %
            </span>
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ink-3)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#8b5cf6' }} />
              المراجعات
            </span>
          </div>
        </div>
        {trend.isLoading ? (
          <div className="h-64 flex items-center justify-center text-xs" style={{ color: 'var(--ink-3)' }}>
            جارٍ التحميل...
          </div>
        ) : trend.isError ? (
          <div className="h-64 flex items-center justify-center text-xs" style={{ color: 'var(--danger)' }}>
            تعذّر تحميل الاتجاه الشهري
          </div>
        ) : (
          <div style={{ height: 280 }} dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.4} />
                <XAxis
                  dataKey="month"
                  tickFormatter={fmtMonth}
                  tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
                  axisLine={{ stroke: 'var(--line)' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
                  axisLine={{ stroke: 'var(--line)' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelFormatter={fmtMonth}
                />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  name="الجودة %"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="المراجعات"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Quality KPIs */}
      <div>
        <h2 className="text-xs font-bold mb-2.5" style={{ color: 'var(--ink-3)' }}>
          مؤشرات الجودة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quality.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : quality.isError ? (
            <div className="col-span-2 md:col-span-3 card p-4 text-xs" style={{ color: 'var(--danger)' }}>
              تعذّر تحميل مؤشرات الجودة
            </div>
          ) : (
            <>
              <KpiCard
                label="متوسط الجودة"
                value={fmtPct(quality.data?.avg_quality)}
                sub={`${fmtNum(quality.data?.total_files)} ملف`}
                icon={BarChart3}
                color="#0ea5e9"
              />
              <KpiCard
                label="أفضل مراجع"
                value={quality.data?.top_reviewer ?? '—'}
                sub="الأعلى تقييماً"
                icon={Award}
                color="#f59e0b"
              />
              <KpiCard
                label="أيام العمل"
                value={fmtNum(quality.data?.working_days)}
                sub={`${quality.data?.total_reviewers ?? 0} مراجع`}
                icon={Calendar}
                color="#10b981"
              />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
