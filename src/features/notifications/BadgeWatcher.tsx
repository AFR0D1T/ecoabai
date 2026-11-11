import { useEffect } from 'react';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '@/config';
import { useSession } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useCommunity';

function readSeen(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.seenBadgeNotifications) ?? '{}') as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeSeen(v: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEYS.seenBadgeNotifications, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/**
 * Следит за уведомлениями о новых значках и показывает анимированный тост.
 * При первом запуске для пользователя — помечает существующие как просмотренные.
 */
export function BadgeWatcher() {
  const { user } = useSession();
  const { data } = useNotifications();

  useEffect(() => {
    if (!user || !data) return;
    const all = readSeen();
    const badgeNotifs = data.filter((n) => n.kind === 'badge_earned');
    const seen = all[user.id];
    if (!seen) {
      all[user.id] = badgeNotifs.map((n) => n.id);
      writeSeen(all);
      return;
    }
    const fresh = badgeNotifs.filter((n) => !seen.includes(n.id) && !n.is_read);
    if (!fresh.length) return;
    for (const n of fresh) {
      const [icon, ...rest] = n.title.split(' ');
      toast.custom(
        () => (
          <div className="flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border-2 border-primary bg-card p-4 shadow-xl">
            <span className="animate-badge-pop text-4xl" aria-hidden>
              {icon}
            </span>
            <div>
              <p className="font-semibold">{rest.join(' ')}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
            </div>
          </div>
        ),
        { duration: 6000 },
      );
    }
    all[user.id] = [...seen, ...fresh.map((n) => n.id)];
    writeSeen(all);
  }, [user, data]);

  return null;
}
