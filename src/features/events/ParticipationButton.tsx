import { useTranslation } from 'react-i18next';
import { Check, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useAuthGate } from '@/components/layout/AuthGate';
import { useSession } from '@/hooks/useAuth';
import { useMyParticipationMap, useToggleParticipation } from '@/hooks/useEvents';
import { isEventFull, isEventPast } from '@/lib/domain';
import type { EcoEvent } from '@/types';
import { cn } from '@/lib/utils';

export function ParticipationButton({
  event,
  className,
  size = 'default',
}: {
  event: EcoEvent;
  className?: string;
  size?: ButtonProps['size'];
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const { requireAuth } = useAuthGate();
  const { data: map } = useMyParticipationMap();
  const toggle = useToggleParticipation();

  const status = map?.[event.id];
  const joined = status === 'registered' || status === 'attended';
  const past = isEventPast(event);
  const full = isEventFull(event);
  const cls = cn('w-full', className);

  if (status === 'attended') {
    return (
      <Button size={size} variant="secondary" disabled className={cls}>
        <Check /> {t('events.attended')}
      </Button>
    );
  }
  if (event.status === 'cancelled') {
    return <Button size={size} variant="outline" disabled className={cls}>{t('events.cancelledShort')}</Button>;
  }
  if (past) {
    return <Button size={size} variant="outline" disabled className={cls}>{t('events.finished')}</Button>;
  }
  if (event.status === 'draft') {
    return <Button size={size} variant="outline" disabled className={cls}>{t('eventStatus.draft')}</Button>;
  }
  if (user && joined) {
    return (
      <Button
        size={size}
        variant="outline"
        className={cn(cls, 'border-primary text-primary')}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ eventId: event.id, join: false })}
        aria-label={t('events.cancelParticipation')}
      >
        <Check /> {t('events.youParticipate')}
        <span className="inline-flex items-center gap-1 font-normal text-muted-foreground">
          — <X className="h-3.5 w-3.5" aria-hidden /> {t('events.cancel')}
        </span>
      </Button>
    );
  }
  if (full) {
    return <Button size={size} disabled className={cls}>{t('events.noSeats')}</Button>;
  }
  return (
    <Button
      size={size}
      className={cls}
      disabled={toggle.isPending}
      onClick={() =>
        requireAuth(() =>
          toggle.mutate(
            { eventId: event.id, join: true },
            { onSuccess: () => toast.success(t('events.joinedToast')) },
          ),
        )
      }
    >
      <UserPlus /> {t('events.join')}
    </Button>
  );
}
