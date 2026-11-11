import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, CalendarCheck, CalendarDays, History, LogOut, MessageSquareWarning, Pencil, Star, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Avatar } from '@/components/Avatar';
import { ReportStatusBadge, ReportTypeLabel } from '@/components/StatusBadges';
import { EventCard, EventCardSkeleton } from '@/features/events/EventCard';
import { ReportTimeline } from '@/features/reports/ReportTimeline';
import { BadgesGrid } from '@/features/profile/BadgesGrid';
import { EditProfileDialog } from '@/features/profile/EditProfileDialog';
import { InstallAppCard } from '@/features/profile/InstallAppCard';
import { useSession, useSignOut } from '@/hooks/useAuth';
import { useMyParticipations } from '@/hooks/useEvents';
import { useMyReports } from '@/hooks/useReports';
import { useMyBadges, useUserRank } from '@/hooks/useCommunity';
import { fmtDate, fmtNumber } from '@/lib/format';
import { isEventPast } from '@/lib/domain';
import { cn } from '@/lib/utils';

function Section({ id, icon: Icon, title, children }: { id?: string; icon: typeof Star; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const signOut = useSignOut();
  const [editOpen, setEditOpen] = useState(false);

  const participations = useMyParticipations();
  const reports = useMyReports();
  const badges = useMyBadges();
  const rank = useUserRank(user?.id);

  // прокрутка к якорю (#badges, #report-<id>) после загрузки
  useEffect(() => {
    if (!hash || reports.isLoading || badges.isLoading) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary');
      const timer = setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2500);
      return () => clearTimeout(timer);
    }
  }, [hash, reports.isLoading, badges.isLoading]);

  if (!user) return null;

  const all = participations.data ?? [];
  const upcoming = all.filter((p) => p.participation.status === 'registered' && !isEventPast(p.event) && p.event.status !== 'cancelled');
  const history = all.filter((p) => isEventPast(p.event) || p.participation.status === 'attended' || p.participation.status === 'no_show');

  return (
    <div className="container max-w-3xl space-y-4 py-4 md:py-8">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar first={user.first_name} last={user.last_name} url={user.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{user.first_name} {user.last_name}</h1>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil /> {t('profile.edit')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate('/') })}>
              <LogOut /> {t('auth.signOut')}
            </Button>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary p-3 text-center">
            <dt className="flex items-center justify-center gap-1 text-xs text-secondary-foreground"><Star className="h-4 w-4" aria-hidden /> {t('profile.points')}</dt>
            <dd className="text-2xl font-bold text-primary">{fmtNumber(user.points)}</dd>
          </div>
          <div className="relative rounded-xl bg-secondary p-3 text-center hover:bg-accent">
            <dt className="flex items-center justify-center gap-1 text-xs text-secondary-foreground"><Trophy className="h-4 w-4" aria-hidden /> {t('profile.rank')}</dt>
            <dd className="text-2xl font-bold text-primary">
              <Link to="/leaderboard" className="after:absolute after:inset-0 after:content-['']">
                {rank.isLoading ? <Skeleton className="mx-auto h-8 w-16" /> : rank.data?.rank ? t('profile.rankOf', { rank: rank.data.rank, total: rank.data.total }) : '—'}
              </Link>
            </dd>
          </div>
        </dl>
      </Card>

      <InstallAppCard />

      <Section icon={CalendarCheck} title={t('profile.upcoming')}>
        <div className="space-y-2">
          {participations.isLoading && <EventCardSkeleton compact />}
          {!participations.isLoading && upcoming.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title={t('profile.noUpcoming')}
              action={<Button asChild size="sm"><Link to="/events">{t('profile.findEvents')}</Link></Button>}
            />
          )}
          {upcoming.map((p) => <EventCard key={p.event.id} event={p.event} compact />)}
        </div>
      </Section>

      <Section icon={History} title={t('profile.history')}>
        {participations.isLoading && <Skeleton className="h-16" />}
        {!participations.isLoading && history.length === 0 && <p className="text-sm text-muted-foreground">{t('profile.noHistory')}</p>}
        <ul className="divide-y">
          {history.map(({ event, participation }) => (
            <li key={event.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Link to={`/events/${event.id}`} className="line-clamp-1 font-medium hover:underline">{event.title}</Link>
                <p className="text-xs text-muted-foreground">{fmtDate(event.starts_at)}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  participation.status === 'attended' ? 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200' : 'bg-muted text-muted-foreground',
                )}
              >
                {participation.status === 'attended'
                  ? t('profile.attendedPoints', { count: event.points_reward })
                  : participation.status === 'no_show'
                    ? t('profile.noShow')
                    : t('profile.pendingConfirm')}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={MessageSquareWarning} title={t('profile.myReports')}>
        <div className="space-y-3">
          {reports.isLoading && <Skeleton className="h-28" />}
          {!reports.isLoading && reports.data?.length === 0 && (
            <EmptyState
              icon={MessageSquareWarning}
              title={t('profile.noReports')}
              action={<Button asChild size="sm"><Link to="/report/new">{t('map.reportProblem')}</Link></Button>}
            />
          )}
          {reports.data?.map((r) => (
            <article key={r.id} id={`report-${r.id}`} className="scroll-mt-20 space-y-3 rounded-xl border p-3 transition-shadow">
              <div className="flex items-start gap-3">
                {r.photo_urls[0] && <img src={r.photo_urls[0]} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ReportTypeLabel type={r.type} className="text-sm" />
                    <ReportStatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</p>
                  <p className="mt-1 line-clamp-2 text-sm">{r.description}</p>
                </div>
              </div>
              <ReportTimeline status={r.status} history={r.history} />
              {r.admin_comment && (
                <p className="rounded-lg bg-muted p-2.5 text-sm">
                  <span className="font-medium">{t('profile.adminComment')}:</span> {r.admin_comment}
                </p>
              )}
              {r.resolved_photo_url && (
                <figure className="flex items-center gap-2 text-xs text-muted-foreground">
                  <img src={r.resolved_photo_url} alt="" className="h-14 w-20 rounded-md object-cover" />
                  <figcaption>{t('profile.afterPhoto')}</figcaption>
                </figure>
              )}
            </article>
          ))}
        </div>
      </Section>

      <Section id="badges" icon={Award} title={t('profile.badges')}>
        <BadgesGrid items={badges.data} isLoading={badges.isLoading} />
      </Section>

      <EditProfileDialog user={user} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
