import { Link, NavLink } from 'react-router-dom';
import {
  Search, Bell, LogIn, Home, LayoutDashboard, Info, Shield, Command, Menu,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/core/auth';
import { ThemeToggle } from './ThemeToggle';
import { FontSizeControl } from './FontSizeControl';
import { UserChip } from './UserChip';
import { Logo } from './Logo';

interface HeaderProps {
  variant?: 'public' | 'workspace';
  onMenuClick?: () => void;
  onCollapseToggle?: () => void;
  sidebarCollapsed?: boolean;
}

export function Header({
  variant = 'public',
  onMenuClick,
  onCollapseToggle,
  sidebarCollapsed = false,
}: HeaderProps) {
  const { user, loading } = useAuth();

  return (
    <header className={`app-header-floating ${variant}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
        {/* Top glow line */}
        <div
          className="absolute top-0 right-0 left-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
            opacity: 0.5,
          }}
        />

        {/* ── Left group: collapse/menu + brand ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Desktop: collapse toggle */}
          {variant === 'workspace' && (
            <button
              type="button"
              onClick={onCollapseToggle}
              className="hidden lg:flex btn-icon"
              aria-label={sidebarCollapsed ? 'فتح القائمة' : 'إغلاق القائمة'}
              title={sidebarCollapsed ? 'فتح القائمة' : 'إغلاق القائمة'}
            >
              {sidebarCollapsed ? (
                <ChevronsLeft size={16} />
              ) : (
                <ChevronsRight size={16} />
              )}
            </button>
          )}

          {/* Mobile: hamburger */}
          {variant === 'workspace' && (
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden btn-icon"
              aria-label="فتح القائمة"
            >
              <Menu size={18} />
            </button>
          )}

          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2 group">
            <motion.div whileHover={{ scale: 1.08, rotate: 8 }} transition={{ type: 'spring', stiffness: 400 }}>
              <Logo size={30} />
            </motion.div>
            <div className="flex flex-col leading-none">
              <span
                className="text-[11.5px] sm:text-[13px] font-extrabold tracking-wide"
                style={{ color: 'var(--ink)' }}
              >
                VEXORIS
              </span>
              <span
                className="hidden sm:block text-[9px] font-bold tracking-[0.18em] mt-0.5"
                style={{ color: 'var(--ink-4)' }}
              >
                MEDICAL ERP
              </span>
            </div>
          </Link>
        </div>

        {/* ── Center nav ── */}
        <nav
          className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
        >
          {user ? (
            <NavItem to="/dashboard" icon={<LayoutDashboard size={13} />} label="لوحة التحكم" />
          ) : (
            <NavItem to="/" icon={<Home size={13} />} label="الرئيسية" />
          )}
          <NavItem to="/about" icon={<Info size={13} />} label="عن النظام" />
          <NavItem to="/security" icon={<Shield size={13} />} label="الأمان" />
        </nav>

        {/* ── Search ── */}
        <button
          type="button"
          className="hidden xl:flex items-center gap-2 h-9 px-3 rounded-xl border flex-1 max-w-[320px] mx-auto transition-all duration-200 group"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--line)', color: 'var(--ink-3)' }}
        >
          <Search size={13} className="transition-transform group-hover:scale-110" />
          <span className="text-[11.5px] font-medium flex-1 text-right">بحث سريع...</span>
          <kbd
            className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-mono font-bold"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-3)' }}
          >
            <Command size={9} /> K
          </kbd>
        </button>

        {/* ── Right actions ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <div className="hidden sm:flex">
            <FontSizeControl />
          </div>

          <ThemeToggle />

          <button className="btn-icon relative" aria-label="الإشعارات">
            <Bell size={15} />
            <span
              className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full ring-2 animate-pulse"
              style={{
                background: 'var(--danger)',
                boxShadow: '0 0 0 2px var(--surface), 0 0 8px var(--danger)',
              }}
            />
          </button>

          <div className="hidden sm:block w-px h-4 mx-1" style={{ background: 'var(--line)' }} />

          {loading ? (
            <div className="w-24 h-8 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ) : user ? (
            <UserChip />
          ) : (
            <Link to="/login" className="btn btn-primary h-8 px-3 text-[11.5px]">
              <LogIn size={13} />
              <span className="hidden sm:inline">تسجيل الدخول</span>
              <span className="sm:hidden">دخول</span>
            </Link>
          )}
        </div>
      </motion.div>
    </header>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11.5px] font-bold
         transition-all duration-150 ${isActive ? 'shadow-sm' : ''}`
      }
      style={({ isActive }) => ({
        color: isActive ? 'var(--ink)' : 'var(--ink-3)',
        background: isActive ? 'var(--surface)' : 'transparent',
      })}
    >
      {icon}
      {label}
    </NavLink>
  );
}
