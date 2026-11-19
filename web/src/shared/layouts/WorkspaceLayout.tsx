import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/shared/components/Header';
import { Footer } from '@/shared/components/Footer';
import { Sidebar } from '@/shared/components/Sidebar';

export function WorkspaceLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist collapse across refreshes
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('vex-sidebar-collapsed') === 'true';
  });

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('vex-sidebar-collapsed', String(next));
      return next;
    });
  }

  return (
    <div
      className="app-shell"
      data-sidebar={collapsed ? 'collapsed' : undefined}
    >
      <Header
        variant="workspace"
        onMenuClick={() => setMobileOpen(true)}
        onCollapseToggle={toggleCollapsed}
        sidebarCollapsed={collapsed}
      />
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onCollapseToggle={toggleCollapsed}
      />
      <div
        className="sidebar-overlay"
        data-open={mobileOpen ? 'true' : 'false'}
        onClick={() => setMobileOpen(false)}
      />
      <main className="app-main">
        <div className="content-container">
          <Outlet />
        </div>
      </main>
      <Footer variant="workspace" />
    </div>
  );
}
