import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './shared/layouts/AppLayout';
import { WorkspaceLayout } from './shared/layouts/WorkspaceLayout';
import { FullPageLoading } from './shared/components/Loading';

const Home      = lazy(() => import('./modules/dashboard/Home'));
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));

function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = `${e.clientX}px`;
        ref.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return <div ref={ref} className="cursor-glow" />;
}

export default function App() {
  return (
    <>
      <CursorGlow />
      <Suspense fallback={<FullPageLoading label="جاري التحميل..." />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
          </Route>
          <Route element={<WorkspaceLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
