import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Stethoscope, Ambulance, FileText,
  Users, Shield, Database, ScrollText, GraduationCap,
  Activity, ClipboardList, ChevronLeft, ChevronRight,
  Settings, HelpCircle, BookOpen, X
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}

type NavItemType = { to: string; icon: React.ReactNode; label: string };
type NavSection = { label: string; items: NavItemType[] };

const SECTIONS: NavSection[] = [
  {
    label: 'نظرة عامة',
    items: [
      { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'لوحة التحكم' },
      { to: '/analytics', icon: <BarChart3 size={16} />,       label: 'التحليلات' },
    ],
  },
  {
    label: 'الوحدات الطبية',
    items: [
      { to: '/medical-audit',   icon: <Stethoscope size={16} />,   label: 'المراجعة الطبية' },
      { to: '/emergency-audit', icon: <Ambulance size={16} />,     label: 'مراجعة الطوارئ' },
      { to: '/doctor-notes',    icon: <FileText size={16} />,      label: 'ملاحظات الأطباء' },
      { to: '/discharge',       icon: <ClipboardList size={16} />, label: 'مؤشر الخروج' },
      { to: '/workflow',        icon: <Activity size={16} />,      label: 'سير العمل' },
    ],
  },
  {
    label: 'التدريب',
    items: [
      { to: '/courses', icon: <GraduationCap size={16} />, label: 'الدورات' },
      { to: '/library', icon: <BookOpen size={16} />,      label: 'المكتبة' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { to: '/admin/users',     icon: <Users size={16} />,      label: 'المستخدمون' },
      { to: '/admin/rbac',      icon: <Shield size={16} />,     label: 'الصلاحيات' },
      { to: '/admin/catalogs',  icon: <Database size={16} />,   label: 'الفهارس' },
      { to: '/admin/audit-log', icon: <ScrollText size={16} />, label: 'سجل التدقيق' },
    ],
  },
];

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onCollapseToggle,
}: SidebarProps) {
  return (
    <aside
      data-mobile-open={mobileOpen ? 'true' : 'false'}
      className="app-sidebar flex flex-col border-l overflow-hidden relative"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--line)',
        width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
      }}
    >
      {/* Mobile close button */}
      <button
        type="button"
        onClick={onMobileClose}
        className="lg:hidden absolute top-3 left-3 btn-icon z-10"
        aria-label="إغلاق القائمة"
      >
        <X size={18} />
      </button>

      {/* Top glow line */}
      <div
        className="absolute top-0 right-0 left-0 h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', opacity: 0.4 }}
      />

      <nav className="sidebar-nav relative flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 mt-11 lg:mt-0">
        {SECTIONS.map((section, idx) => (
          <div key={section.label} className={idx > 0 ? 'sidebar-section mt-4' : 'sidebar-section'}>
            {/* ✅ نعرضه دايماً — CSS هيخفيه لو collapsed (desktop only) */}
            <div className="sidebar-label label px-2 mb-1.5">{section.label}</div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }
                  title={item.label}
                >
                  <span className="sidebar-icon shrink-0">{item.icon}</span>
                  <span className="sidebar-text flex-1 truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        <div className="sidebar-section mt-4">
          <div className="sidebar-label label px-2 mb-1.5">النظام</div>
          <div className="space-y-0.5">
            <NavLink
              to="/settings"
              onClick={onMobileClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="الإعدادات"
            >
              <Settings size={16} className="sidebar-icon shrink-0" />
              <span className="sidebar-text flex-1">الإعدادات</span>
            </NavLink>
            <NavLink
              to="/help"
              onClick={onMobileClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title="المساعدة"
            >
              <HelpCircle size={16} className="sidebar-icon shrink-0" />
              <span className="sidebar-text flex-1">المساعدة</span>
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Desktop footer toggle */}
      <div
        className="hidden lg:flex relative border-t p-2 items-center"
        style={{ borderColor: 'var(--line)' }}
      >
        <button
          type="button"
          onClick={onCollapseToggle}
          className="btn-icon w-full justify-center"
          title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
        >
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
    </aside>
  );
}
