import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/auth';
import { FullPageLoading } from '@/shared/components/Loading';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps = {}) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoading label="جارٍ التحقق من الجلسة..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
