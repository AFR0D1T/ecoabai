import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { useSession } from '@/hooks/useAuth';
import { FullPageSpinner } from './FullPageSpinner';

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children ? <>{children}</> : <Outlet />;
}

/** Доступ только для admin. Житель → на главную, гость → на вход. */
export function RequireAdmin({ children }: { children?: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace state={{ forbidden: true }} />;
  return children ? <>{children}</> : <Outlet />;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const [params] = useSearchParams();
  if (isLoading) return <FullPageSpinner />;
  if (user) {
    const next = params.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    return <Navigate to={safe ?? (user.role === 'admin' ? '/admin' : '/')} replace />;
  }
  return <>{children}</>;
}
