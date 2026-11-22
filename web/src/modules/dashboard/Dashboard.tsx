import { useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  RefreshCw, AlertCircle, FileText, Building2, Stethoscope,
  Users, ClipboardList, UserRound,
} from 'lucide-react';
import { useAuth } from '@/core/auth';
import { useOverviewStats, useMonthlyTrend, useQualityKpis } from '@/hooks/useDashboard';
import type { DateType, MonthlyTrendPoint } from '@/core/types';
import { fmtNum, fmtMonth } from '@/shared/lib/format';

const DATE_OPTIONS: { value: DateType; label: string }[] = [
  { value: 'discharge', label: 'تاريخ الخروج' },
  { value: 'admission', label: 'تاريخ الدخول' },
  { value: 'review',    label: 'تاريخ المراجعة' },
];

const fmtDec = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('ar-EG', { maximumFractionDigits: 1 });
const fmtPctAr = (n: number | null | undefined) =>
  n == null ? '—' : `${Math.round(n).toLocaleString('ar-EG')}٪`;

/* ───────── مكوّنات صغيرة ───────── */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--surface-2)' }} />;
}

function ErrorBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--danger)' }}>
      <AlertCircle size={15} className="shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-bold mb-1">تعذّر تحميل البيانات</div>
        <div className="mb-2 opacity-80 break-words">{text}</div>
        <button type="button" onClick={onRetry} className="btn btn-secondary h-8 text-[11px]">
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value, onChange, options, ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex p-0.5 rounded-lg border"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--line)' }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className="h-7 px-3 rounded-md text-[11.5px] font-bold transition-colors"
            style={{
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--primary)' : 'var(--ink-3)',
              boxShadow: on ? '0 1px 2px rgba(10,15,26,0.08)' : 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 128 128" className="w-full h-full" role="img" aria-label={`نسبة الالتزام ${Math.round(pct)} بالمئة`}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--grad-from)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--grad-to)' }} />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none" stroke="url(#gaugeGrad)" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-extrabold tabular" style={{ color: 'var(--ink)' }}>{fmtPctAr(pct)}</div>
        <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--ink-3)' }}>نسبة الالتزام</div>
      </div>
    </div>
  );
}

type Metric = 'count' | 'percentage';

function TrendChart({ data, metric }: { data: MonthlyTrendPoint[]; metric: Metric }) {
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-xs" style={{ color: 'var(--ink-3)' }}>
        لا توجد بيانات في هذه الفترة.
      </div>
    );
  }

  const max = metric === 'percentage' ? 100 : Math.max(...data.map((d) => d.count), 1);
  const shown = active ?? data.length - 1;
  const cur = data[shown];
  const curValue = metric === 'percentage' ? fmtPctAr(cur.percentage) : fmtNum(cur.count);

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-extrabold tabular" style={{ color: 'var(--ink)' }}>{curValue}</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>{fmtMonth(cur.month)}</span>
      </div>

      <div className="flex items-end gap-1.5 h-44" onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => {
          const v = metric === 'percentage' ? d.percentage : d.count;
          const h = Math.max((v / max) * 100, 2);
          const on = i === shown;
          return (
            <button
              key={d.month}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${fmtMonth(d.month)}: ${metric === 'percentage' ? fmtPctAr(d.percentage) : fmtNum(d.count)}`}
              className="flex-1 h-full flex items-end rounded-md outline-none focus-visible:ring-2"
            >
              <span
                className="w-full rounded-t-md"
                style={{
                  height: `${h}%`,
                  background: on
                    ? 'linear-gradient(to top, var(--grad-from), var(--grad-to))'
                    : 'color-mix(in srgb, var(--primary) 22%, transparent)',
                  transition: 'height 500ms cubic-bezier(0.16,1,0.3,1), background 150ms',
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex justify-between mt-2 text-[10.5px] font-semibold" style={{ color: 'var(--ink-4)' }}>
        <span>{fmtMonth(data[0].month)}</span>
        {data.length > 1 && <span>{fmtMonth(data[data.length - 1].month)}</span>}
      </div>
    </div>
  );
}

/* ───────── الصفحة ───────── */

export default function Dashboard() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['dashboard'] }) > 0;

  const [dateType, setDateType] = useState<DateType>('discharge');
  const [monthsBack, setMonthsBack] = useState(12);
  const [metric, setMetric] = useState<Metric>('count');

  const overview = useOverviewStats(dateType);
  const trend = useMonthlyTrend(monthsBack, dateType);
  const quality = useQualityKpis(dateType);

  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || '';
  const dateLabel = DATE_OPTIONS.find((o) => o.value === dateType)!.label;

  const counts = overview.data
    ? [
        { icon: FileText,      label: 'النماذج',       value: overview.data.total_forms },
        { icon: Building2,     label: 'الوحدات',       value: overview.data.total_units },
        { icon: Stethoscope,   label: 'الأطباء',       value: overview.data.total_doctors },
        { icon: UserRound,     label: 'التمريض',       value: overview.data.total_nurses },
        { icon: Users,         label: 'السكرتارية',    value: overview.data.total_clerks },
      ]
    : [];

  const kpis = quality.data
    ? [
        { label: 'متوسط الجودة',        value: fmtDec(quality.data.avg_quality) },
        { label: 'الملفات المراجَعة',   value: fmtNum(quality.data.total_files) },
        { label: 'عدد المراجعين',       value: fmtNum(quality.data.total_reviewers) },
        { label: 'أيام العمل',          value: fmtNum(quality.data.working_days) },
        { label: 'متوسط الملفات لكل مراجع', value: fmtDec(quality.data.avg_per_reviewer) },
        { label: 'الأعلى نشاطاً',       value: quality.data.top_reviewer || '—' },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4 max-w-6xl"
    >
      {/* العنوان وعناصر التحكم */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            {name ? `مرحباً، ${name}` : 'لوحة التحكم'}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
            مؤشرات الجودة محسوبة حسب {dateLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Segmented value={dateType} onChange={setDateType} options={DATE_OPTIONS} ariaLabel="نوع التاريخ" />
          <button
            type="button"
            className="btn btn-secondary h-9 text-xs"
            onClick={() => qc.invalidateQueries({ queryKey: ['dashboard'] })}
            disabled={fetching}
          >
            <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {/* الالتزام + الاتجاه */}
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="card p-5 flex flex-col">
          <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--ink)' }}>الالتزام الكلي</h2>
          {overview.isLoading ? (
            <Skeleton className="w-44 h-44 rounded-full mx-auto" />
          ) : overview.isError ? (
            <ErrorBox text={(overview.error as Error).message} onRetry={() => overview.refetch()} />
          ) : overview.data ? (
            <>
              <Gauge value={overview.data.overall_pct} />
              <div
                className="mt-5 pt-4 border-t flex items-center justify-between text-xs"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: 'var(--ink-3)' }}>
                  <ClipboardList size={13} /> إجمالي المراجعات
                </span>
                <span className="font-bold tabular" style={{ color: 'var(--ink)' }}>
                  {fmtNum(overview.data.total_reviews)}
                </span>
              </div>
            </>
          ) : null}
        </section>

        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>الاتجاه الشهري</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Segmented
                value={metric}
                onChange={setMetric}
                ariaLabel="المقياس"
                options={[
                  { value: 'count', label: 'العدد' },
                  { value: 'percentage', label: 'النسبة' },
                ]}
              />
              <Segmented
                value={String(monthsBack)}
                onChange={(v) => setMonthsBack(Number(v))}
                ariaLabel="المدة"
                options={[
                  { value: '6', label: '٦ أشهر' },
                  { value: '12', label: '١٢ شهراً' },
                  { value: '24', label: '٢٤ شهراً' },
                ]}
              />
            </div>
          </div>

          {trend.isLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : trend.isError ? (
            <ErrorBox text={(trend.error as Error).message} onRetry={() => trend.refetch()} />
          ) : (
            <TrendChart data={trend.data ?? []} metric={metric} />
          )}
        </section>
      </div>

      {/* الأعداد — بطاقة واحدة بدل خمس بطاقات متطابقة */}
      <section className="card p-0 overflow-hidden">
        {overview.isLoading ? (
          <div className="p-5"><Skeleton className="h-14 w-full" /></div>
        ) : overview.data ? (
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {counts.map((c, i) => (
              <div
                key={c.label}
                className="p-4 sm:p-5 flex items-center gap-3"
                style={{
                  borderInlineStart: i > 0 ? '1px solid var(--line)' : undefined,
                  borderTop: i >= 2 ? '1px solid var(--line)' : undefined,
                }}
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                >
                  <c.icon size={16} />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold truncate" style={{ color: 'var(--ink-3)' }}>{c.label}</dt>
                  <dd className="text-lg font-bold tabular" style={{ color: 'var(--ink)' }}>{fmtNum(c.value)}</dd>
                </div>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {/* جودة المراجعة */}
      <section className="card p-5">
        <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--ink)' }}>أداء المراجعين</h2>
        {quality.isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
          </div>
        ) : quality.isError ? (
          <ErrorBox text={(quality.error as Error).message} onRetry={() => quality.refetch()} />
        ) : (
          <dl className="grid sm:grid-cols-2 gap-x-10">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="flex items-center justify-between gap-3 py-2.5 border-b text-xs"
                style={{ borderColor: 'var(--line)' }}
              >
                <dt className="font-semibold" style={{ color: 'var(--ink-3)' }}>{k.label}</dt>
                <dd className="font-bold tabular text-sm truncate" style={{ color: 'var(--ink)' }}>{k.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </motion.div>
  );
}
