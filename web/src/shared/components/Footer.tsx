import { Activity, Sparkles, Copyright } from 'lucide-react';

interface FooterProps {
  variant?: 'public' | 'workspace';
}

export function Footer({ variant = 'public' }: FooterProps) {
  return (
    <footer className={`app-footer-floating ${variant}`}>
      <div
        className="mx-auto max-w-[1120px] h-14 px-3 rounded-[20px]
                   flex items-center justify-between gap-2
                   border relative overflow-hidden"
        style={{
          background: 'var(--glass)',
          borderColor: 'var(--line)',
          backdropFilter: 'blur(20px) saturate(200%)',
          WebkitBackdropFilter: 'blur(20px) saturate(200%)',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.03), 0 16px 40px -8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Top gradient glow line */}
        <div
          className="absolute top-0 right-0 left-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--grad-from), var(--primary), var(--grad-to), transparent)',
            opacity: 0.6,
          }}
        />

        {/* Ambient corner glows */}
        <div
          className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'var(--primary-glow)', opacity: 0.30 }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(56, 189, 248, 0.15)', opacity: 0.30 }}
        />

        {/* ═══ Brand (left) ═══ */}
        <div className="flex items-center gap-2 shrink-0 relative">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-lg shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))',
              boxShadow: '0 2px 6px -1px var(--primary-glow)',
            }}
          >
            <Activity size={12} color="#fff" strokeWidth={2.8} />
          </span>
          <span
            className="text-[11.5px] font-extrabold tracking-wider hidden sm:inline"
            style={{
              background: 'linear-gradient(135deg, var(--grad-from), var(--primary), var(--grad-to))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% auto',
              animation: 'gradient-shift 8s ease infinite',
            }}
          >
            VEXORIS
          </span>
        </div>

        {/* ═══ Credits (center) ═══ */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center relative min-w-0">
          <span
            className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold shrink-0"
            style={{ color: 'var(--ink-3)' }}
          >
            <Sparkles size={10} style={{ color: 'var(--primary)' }} />
            تطوير
          </span>

          <div className="flex items-center gap-1">
            {/* خالد شوقي — Sky */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold
                         transition-all duration-200 hover:scale-105 cursor-default whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(14, 165, 233, 0.10))',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: 'var(--info)',
                boxShadow: '0 2px 8px -3px rgba(56, 189, 248, 0.30)',
              }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: 'var(--info)', boxShadow: '0 0 4px var(--info)' }}
              />
              نادية عادل
            </span>

            <span className="text-[9px]" style={{ color: 'var(--ink-4)' }}>·</span>

            {/* خالد شوقي — Violet */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold
                         transition-all duration-200 hover:scale-105 cursor-default whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(139, 92, 246, 0.10))',
                border: '1px solid rgba(167, 139, 250, 0.35)',
                color: 'var(--violet)',
                boxShadow: '0 2px 8px -3px rgba(167, 139, 250, 0.30)',
              }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: 'var(--violet)', boxShadow: '0 0 4px var(--violet)' }}
              />
              خالد شوقي
            </span>
          </div>
        </div>

        {/* ═══ Copyright (right) ═══ */}
        <div
          className="hidden md:flex items-center gap-1 text-[10px] font-semibold shrink-0 relative"
          style={{ color: 'var(--ink-3)' }}
        >
          <Copyright size={10} style={{ color: 'var(--ink-4)' }} />
          <span>جميع حقوق النسخ والطبع محفوظة لنظام</span>
          <span
            className="font-extrabold"
            style={{
              background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Vexoris
          </span>
          <span className="font-bold tabular" style={{ color: 'var(--primary)' }}>
            @2025
          </span>
        </div>

        {/* Mobile short copyright */}
        <div
          className="md:hidden flex items-center gap-1 text-[9.5px] font-bold shrink-0 relative"
          style={{ color: 'var(--ink-3)' }}
        >
          <Copyright size={9} style={{ color: 'var(--ink-4)' }} />
          <span
            style={{
              background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Vexoris
          </span>
          <span style={{ color: 'var(--primary)' }}>@2025</span>
        </div>
      </div>
    </footer>
  );
}
