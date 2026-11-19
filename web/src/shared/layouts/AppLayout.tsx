import { Outlet } from 'react-router-dom';
import { Header } from '@/shared/components/Header';
import { Footer } from '@/shared/components/Footer';

export function AppLayout() {
  return (
    <div className="app-shell no-sidebar">
      <Header variant="public" />
      <main className="app-main">
        <div className="content-container">
          <Outlet />
        </div>
      </main>
      <Footer variant="public" />
    </div>
  );
}
