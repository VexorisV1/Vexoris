import { Sparkles } from 'lucide-react';

export function PlaceholderPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ink)' }}>{title}</h1>
      <div className="card p-10 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--primary-soft)', color: 'var(--primary)',
            boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--primary) 30%, transparent)' }}>
          <Sparkles size={24} />
        </div>
        <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>قريباً</h3>
        <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--ink-3)' }}>
          {description || 'هذه الوحدة قيد التطوير وستكون متاحة في التحديث القادم.'}
        </p>
      </div>
    </div>
  );
}
