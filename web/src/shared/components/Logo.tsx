export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 rounded-lg flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.15), 0 4px 14px -2px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.22)',
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M5 4 L12 20 L19 4" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <div
      className="relative rounded-2xl flex items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--grad-from) 0%, var(--primary) 50%, var(--grad-to) 100%)',
        boxShadow:
          '0 2px 4px rgba(0,0,0,0.10), 0 8px 24px -4px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 60%)' }}
      />
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" className="relative">
        <path d="M5 4 L12 20 L19 4" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
