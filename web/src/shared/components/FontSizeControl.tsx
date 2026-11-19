import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const MIN_SIZE = 12;
const MAX_SIZE = 20;
const STEP = 2;

function applyFontSize(px: number) {
  document.documentElement.style.setProperty('--base-font-size', `${px}px`);
  localStorage.setItem('vex-font-size', String(px));
}

export function FontSizeControl() {
  const [size, setSize] = useState(() => {
    const saved = Number(localStorage.getItem('vex-font-size') || 14);
    return Math.max(MIN_SIZE, Math.min(MAX_SIZE, saved));
  });

  function change(delta: number) {
    const next = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size + delta));
    setSize(next);
    applyFontSize(next);
  }

  const canDecrease = size > MIN_SIZE;
  const canIncrease = size < MAX_SIZE;

  return (
    <div
      className="flex items-center h-7 rounded-lg border overflow-hidden transition-colors"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--line)',
      }}
    >
      {/* Aa label */}
      <span
        className="px-1.5 text-[10px] font-bold select-none"
        style={{ color: 'var(--ink-3)' }}
        title={`حجم الخط الحالي: ${size}px`}
      >
        Aa
      </span>

      <div className="w-px h-4" style={{ background: 'var(--line)' }} />

      {/* Decrease */}
      <button
        type="button"
        onClick={() => change(-STEP)}
        disabled={!canDecrease}
        className="w-6 h-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ color: 'var(--ink-2)' }}
        onMouseEnter={(e) => {
          if (canDecrease) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
        title="تصغير الخط"
        aria-label="تصغير الخط"
      >
        <Minus size={11} strokeWidth={3} />
      </button>

      <div className="w-px h-4" style={{ background: 'var(--line)' }} />

      {/* Increase */}
      <button
        type="button"
        onClick={() => change(STEP)}
        disabled={!canIncrease}
        className="w-6 h-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ color: 'var(--ink-2)' }}
        onMouseEnter={(e) => {
          if (canIncrease) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
        title="تكبير الخط"
        aria-label="تكبير الخط"
      >
        <Plus size={11} strokeWidth={3} />
      </button>
    </div>
  );
}

export function initFontSize() {
  const saved = Number(localStorage.getItem('vex-font-size') || 14);
  applyFontSize(saved);
}
