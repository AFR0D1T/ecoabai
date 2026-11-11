import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, Languages, LogOut, Monitor, Moon, Shield, Sun, User, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type ThemeMode } from './ThemeProvider';
import { useSession, useSignOut } from '@/hooks/useAuth';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useCommunity';
import { useOnline } from '@/hooks/useOnline';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/Avatar';
import { LANGUAGES } from '@/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('header.language')}>
          <Languages className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lng) => (
          <DropdownMenuItem key={lng} onSelect={() => void i18n.changeLanguage(lng)}>
            <Check className={cn(i18n.language === lng ? 'opacity-100' : 'opacity-0')} />
            {t(`lang.${lng}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, resolved, setMode } = useTheme();
  const items: { m: ThemeMode; icon: typeof Sun }[] = [
    { m: 'light', icon: Sun },
    { m: 'dark', icon: Moon },
    { m: 'system', icon: Monitor },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('header.theme')}>
          {resolved === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(({ m, icon: Icon }) => (
          <DropdownMenuItem key={m} onSelect={() => setMode(m)}>
            <Icon /> {t(`theme.${m}`)}
            {mode === m && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = data.filter((n) => !n.is_read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? t('notifications.bellUnread', { count: unread }) : t('notifications.title')}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <DropdownMenuLabel className="p-0">{t('notifications.title')}</DropdownMenuLabel>
          {unread > 0 && (
            <button className="text-xs font-medium text-primary hover:underline" onClick={() => markAll.mutate()}>
              {t('notifications.readAll')}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {data.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">{t('notifications.empty')}</p>}
          {data.slice(0, 6).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex-col items-start gap-0.5"
              onSelect={() => {
                if (!n.is_read) markRead.mutate(n.id);
                if (n.link) navigate(n.link);
              }}
            >
              <span className="flex w-full items-center gap-2 font-medium">
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={t('notifications.unread')} />}
                <span className="line-clamp-1">{n.title}</span>
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
              <span className="text-[11px] text-muted-foreground">{fmtRelative(n.created_at)}</span>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem asChild className="justify-center rounded-none py-2.5 text-primary">
          <Link to="/notifications">{t('notifications.all')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu() {
  const { t } = useTranslation();
  const { user, isAdmin } = useSession();
  const signOut = useSignOut();
  const navigate = useNavigate();
  if (!user) {
    return (
      <Button asChild size="sm">
        <Link to="/login">{t('auth.signIn')}</Link>
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t('header.account')}>
          <Avatar first={user.first_name} last={user.last_name} url={user.avatar_url} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {user.first_name} {user.last_name}
          <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <User /> {t('nav.profile')}
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onSelect={() => navigate('/admin')}>
            <Shield /> {t('nav.admin')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            signOut.mutate(undefined, {
              onSuccess: () => navigate('/'),
            })
          }
        >
          <LogOut /> {t('auth.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-sm font-medium text-black">
      <WifiOff className="h-4 w-4" aria-hidden /> {t('common.offline')}
    </div>
  );
}
