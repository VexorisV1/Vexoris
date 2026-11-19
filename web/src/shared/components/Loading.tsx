type Size = 'sm' | 'md' | 'lg';
const DIM: Record<Size, number> = { sm: 20, md: 36, lg: 64 };

export function Loading({ size = 'md', label }: { size?: Size; label?: string }) {
  const dim = DIM[size];
  return (
    <div className="inline-flex flex-col items-center justify-center gap-2">
      <svg width={dim} height={dim} viewBox="0 0 100 100" style={{ color: 'var(--primary)' }}>
        <path
          d="M 24 22 L 50 80 L 76 22"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{ strokeDasharray: 140 }}
          className="animate-draw-v"
        />
      </svg>
      {label && <span className="text-xs font-semibold" style={{ color: 'var(--ink-3)' }}>{label}</span>}
    </div>
  );
}

export function FullPageLoading({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
      <Loading size="lg" label={label} />
    </div>
  );
}
