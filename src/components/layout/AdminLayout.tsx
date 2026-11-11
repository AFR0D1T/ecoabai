import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarDays, LayoutDashboard, Map, Menu, MessageSquareWarning, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useNewReportsCount } from '@/hooks/useReports';
import { LanguageSwitcher, NotificationBell, OfflineBanner, ThemeToggle, UserMenu } from './HeaderControls';
import { Logo } from './ResidentLayout';

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { data: newCount = 0 } = useNewReportsCount();
  const items = [
    { to: '/admin', label: t('admin.nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/admin/reports', label: t('admin.nav.reports'), icon: MessageSquareWarning, count: newCount },
    { to: '/admin/map', label: t('admin.nav.map'), icon: Map },
    { to: '/admin/events', label: t('admin.nav.events'), icon: CalendarDays },
    { to: '/admin/users', label: t('admin.nav.users'), icon: Users },
    { to: '/admin/settings', label: t('admin.nav.settings'), icon: Settings },
  ];
  return (
    <nav aria-label={t('admin.nav.label')} className="flex flex-1 flex-col gap-1 p-3">
      {items.map(({ to, label, icon: Icon, end, count }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
          <span className="flex-1">{label}</span>
          {!!count && (
            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-black" aria-label={t('admin.nav.newCount', { count })}>
              {count}
            </span>
          )}
        </NavLink>
      ))}
      <div className="mt-auto border-t pt-3">
        <NavLink to="/" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent">
          <ArrowLeft className="h-5 w-5" aria-hidden /> {t('admin.nav.toSite')}
        </NavLink>
      </div>
    </nav>
  );
}

export default function AdminLayout() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-[100dvh]">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Logo />
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">{t('admin.badge')}</span>
        </div>
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-[1000] flex h-14 items-center gap-2 border-b bg-card px-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label={t('admin.nav.open')}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold lg:hidden">{t('admin.title')}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle />
            <div className="ml-1">
              <UserMenu />
            </div>
          </div>
        </header>
        <OfflineBanner />
        <main id="main" className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="left" className="flex flex-col gap-0 p-0">
          <DialogTitle className="flex h-14 items-center border-b px-4">
            <Logo />
          </DialogTitle>
          <SideNav onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
