import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Map, Plus, PlusCircle, Trophy, User, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/useAuth';
import { useAuthGate } from './AuthGate';
import { LanguageSwitcher, NotificationBell, OfflineBanner, ThemeToggle, UserMenu } from './HeaderControls';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2 rounded-md font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Leaf className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-lg tracking-tight">EcoAbai</span>
    </NavLink>
  );
}

export function ResidentLayout() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { requireAuth } = useAuthGate();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fullBleed = pathname === '/';

  const goReport = () => requireAuth(() => navigate('/report/new'));

  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
    );

  const mobileItems = [
    { to: '/', label: t('nav.map'), icon: Map, end: true },
    { to: '/events', label: t('nav.events'), icon: CalendarDays },
    { to: '/report/new', label: t('nav.report'), icon: PlusCircle, gated: true },
    { to: '/profile', label: t('nav.profile'), icon: User, gated: true },
  ];

  return (
    <div className="flex h-[100dvh] flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-card focus:p-2">
        {t('common.skipToContent')}
      </a>
      <header className="z-[1000] border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3">
          <Logo />
          <nav aria-label={t('nav.main')} className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={desktopLink}>{t('nav.map')}</NavLink>
            <NavLink to="/events" className={desktopLink}>{t('nav.events')}</NavLink>
            <NavLink to="/leaderboard" className={desktopLink}>{t('nav.leaderboard')}</NavLink>
            {user && <NavLink to="/profile" className={desktopLink}>{t('nav.profile')}</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-0.5">
            <Button className="mr-2 hidden md:inline-flex" size="sm" onClick={goReport}>
              <PlusCircle /> {t('nav.report')}
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" asChild>
              <NavLink to="/leaderboard" aria-label={t('nav.leaderboard')}>
                <Trophy className="h-5 w-5" />
              </NavLink>
            </Button>
            {user && <NotificationBell />}
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="ml-1">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>
      <OfflineBanner />

      <main id="main" className={cn('relative flex-1', fullBleed ? 'overflow-hidden' : 'overflow-y-auto')}>
        <Outlet />
      </main>

      <nav aria-label={t('nav.main')} className="pb-safe z-[1000] border-t bg-card md:hidden">
        <ul className="grid grid-cols-4">
          {mobileItems.map(({ to, label, icon: Icon, end, gated }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={(e) => {
                  if (gated && !user) {
                    e.preventDefault();
                    requireAuth();
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {to === '/report/new' ? (
                  // главное действие — аккуратная зелёная «пилюля» в общем ряду, без подъёма
                  <span className="flex h-7 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : (
                  <Icon className="h-6 w-6" aria-hidden />
                )}
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
