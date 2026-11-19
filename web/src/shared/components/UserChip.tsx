import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, User, Monitor, LogOut, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/core/auth';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'المطور',
  admin: 'إدارة السجلات',
  manager: 'المدير الطبي',
  auditor: 'مراجع جودة',
  senior: 'رئيس قسم',
  doctor: 'طبيب',
  reviewer_doctor: 'طبيب مراجع',
  viewer: 'مراجع',
};

export function UserChip() {
  const { profile, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'مستخدم';
  const role = profile?.role || 'viewer';
  const roleLabel = ROLE_LABEL[role] || role;
  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 h-8 pr-1 pl-2 rounded-lg border transition-all duration-150"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--line)',
        }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10.5px] font-extrabold shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        >
          {initial}
        </div>
        <div className="text-right leading-tight max-w-[100px]">
          <div className="text-[11px] font-bold truncate" style={{ color: 'var(--ink)' }}>{name}</div>
          <div className="text-[9.5px] font-bold" style={{ color: 'var(--primary)' }}>{roleLabel}</div>
        </div>
        <ChevronDown
          size={11}
          style={{ color: 'var(--ink-4)' }}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full mt-2 w-64 rounded-xl border z-50 overflow-hidden"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--line-2)',
              boxShadow:
                '0 4px 8px rgba(10,15,26,0.06), 0 12px 24px rgba(10,15,26,0.08), 0 24px 48px rgba(10,15,26,0.10)',
            }}
          >
            <div className="p-3 border-b" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-extrabold shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--grad-from), var(--grad-to))',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate" style={{ color: 'var(--ink)' }}>{name}</div>
                  <div className="text-[10.5px] truncate mt-0.5" style={{ color: 'var(--ink-3)' }}>{user?.email}</div>
                </div>
              </div>
              <div
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                <ShieldCheck size={10} />
                {roleLabel}
              </div>
            </div>

            <div className="p-1">
              <MenuItem to="/profile" icon={<User size={13} />} onClick={() => setOpen(false)}>
                إدارة الحساب
              </MenuItem>
              <MenuItem to="/sessions" icon={<Monitor size={13} />} onClick={() => setOpen(false)}>
                الجلسات النشطة
              </MenuItem>
            </div>

            <div className="p-1 border-t" style={{ borderColor: 'var(--line)' }}>
              <button
                type="button"
                onClick={() => { void signOut(); setOpen(false); }}
                className="w-full flex items-center gap-2 h-7 px-2 text-xs font-semibold rounded-md transition-colors"
                style={{ color: 'var(--danger)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <LogOut size={13} />
                تسجيل الخروج
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ to, icon, children, onClick }: {
  to: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="w-full flex items-center gap-2 h-7 px-2 text-xs font-semibold rounded-md transition-colors"
      style={{ color: 'var(--ink-2)' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
        (e.currentTarget as HTMLElement).style.color = 'var(--ink)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--ink-2)';
      }}
    >
      {icon}
      {children}
    </Link>
  );
}
