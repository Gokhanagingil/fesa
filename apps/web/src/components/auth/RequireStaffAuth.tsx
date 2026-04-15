import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';

export function RequireStaffAuth() {
  const location = useLocation();
  const { loading, authenticated } = useAuth();

  if (loading) {
    return <div className="px-4 py-10 text-sm text-amateur-muted">Loading...</div>;
  }

  if (!authenticated) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <Outlet />;
}
