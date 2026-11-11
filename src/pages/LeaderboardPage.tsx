import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react';
import type { LeaderboardPeriod } from '@/types';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Avatar } from '@/components/Avatar';
import { useLeaderboard } from '@/hooks/useCommunity';
import { useSession } from '@/hooks/useAuth';
import { fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const MEDALS = ['🥇', '🥈', '🥉'];

function Residents() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const { data, isLoading } = useLeaderboard(period);
  const { user } = useSession();
  return (
    <div className="space-y-3">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
        <TabsList>
          <TabsTrigger value="month">{t('leaderboard.month')}</TabsTrigger>
          <TabsTrigger value="all">{t('leaderboard.allTime')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="divide-y">
        {isLoading && Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="m-3 h-10" />)}
        {!isLoading && data?.length === 0 && <EmptyState icon={Trophy} title={t('leaderboard.empty')} className="m-3" />}
        <ol>
          {data?.map((e) => (
            <li
              key={e.profile.id}
              className={cn('flex items-center gap-3 px-3 py-2.5', e.profile.id === user?.id && 'bg-secondary')}
              aria-current={e.profile.id === user?.id ? 'true' : undefined}
            >
              <span className="w-8 text-center text-lg font-bold tabular-nums">{e.rank <= 3 ? MEDALS[e.rank - 1] : e.rank}</span>
              <Avatar first={e.profile.first_name} last={e.profile.last_name} url={e.profile.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {e.profile.first_name} {e.profile.last_name.charAt(0)}.
                  {e.profile.id === user?.id && <span className="ml-1 text-xs text-primary">({t('leaderboard.you')})</span>}
                </p>
              </div>
              <span className="font-bold text-primary tabular-nums">{t('leaderboard.points', { count: e.points, formatted: fmtNumber(e.points) })}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
  return (
    <div className="container max-w-3xl py-4 md:py-8">
      <PageHeader title={t('leaderboard.title')} subtitle={t('leaderboard.subtitle')} />
      <Residents />
    </div>
  );
}
