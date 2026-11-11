import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, Bell, BellOff, CalendarClock, CalendarCog, CheckCheck, MessageSquareWarning, RefreshCw } from 'lucide-react';
import type { NotificationKind } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/useCommunity';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  report_status: RefreshCw,
  event_reminder: CalendarClock,
  badge_earned: Award,
  new_report: MessageSquareWarning,
  event_update: CalendarCog,
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = data?.filter((n) => !n.is_read).length ?? 0;

  return (
    <div className="container max-w-2xl py-4 md:py-8">
      <PageHeader
        title={t('notifications.title')}
        actions={
          unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck /> {t('notifications.readAll')}
            </Button>
          )
        }
      />
      {isLoading && <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>}
      {!isLoading && data?.length === 0 && <EmptyState icon={BellOff} title={t('notifications.empty')} />}
      <ul className="space-y-2">
        {data?.map((n) => {
          const Icon = KIND_ICON[n.kind];
          return (
            <li key={n.id}>
              <Card className={cn('transition-colors', !n.is_read && 'border-primary/50 bg-secondary/60')}>
                <button
                  className="flex w-full items-start gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    if (!n.is_read) markRead.mutate(n.id);
                    if (n.link) navigate(n.link);
                  }}
                >
                  <span className="rounded-full bg-card p-2 text-primary shadow-sm"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium">
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" aria-label={t('notifications.unread')} />}
                      {n.title}
                    </span>
                    <span className="block text-sm text-muted-foreground">{n.body}</span>
                    <span className="block text-xs text-muted-foreground">{fmtRelative(n.created_at)}</span>
                  </span>
                </button>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
