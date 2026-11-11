import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, ExternalLink, SearchX, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CategoryBadge, EventStatusBadge } from '@/components/StatusBadges';
import { useEvent, useEventParticipants, useSetAttendance } from '@/hooks/useEvents';
import { useStreetLookup } from '@/hooks/useSettings';
import { downloadFile, slugify, toCsv } from '@/lib/files';
import { fmtDateTime, streetName } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function EventAdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const event = useEvent(id);
  const participants = useEventParticipants(id);
  const setAttendance = useSetAttendance(id ?? '');
  const street = useStreetLookup();

  if (event.isLoading) return <div className="p-6"><Skeleton className="h-40" /></div>;
  if (!event.data) return <div className="p-6"><EmptyState icon={SearchX} title={t('events.notFound')} /></div>;
  const e = event.data;
  const list = participants.data ?? [];
  const attendedCount = list.filter((p) => p.participant.status === 'attended').length;

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [t('admin.users.name'), t('auth.email'), t('admin.users.street'), t('admin.events.cRegistered'), t('admin.events.cAttendance')],
      ...list.map(({ participant, profile }) => [
        `${profile.last_name} ${profile.first_name}`,
        profile.email,
        streetName(street(profile.street_id)),
        fmtDateTime(participant.registered_at),
        t(`participation.${participant.status}`),
      ]),
    ];
    downloadFile(toCsv(rows), `${slugify(e.title) || 'event'}-participants.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link to="/admin/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('admin.events.title')}
      </Link>
      <PageHeader
        title={e.title}
        subtitle={`${fmtDateTime(e.starts_at)}${e.address ? ` · ${e.address}` : ''}`}
        actions={
          <>
            <Button variant="outline" asChild><Link to={`/events/${e.id}`}><ExternalLink /> {t('admin.events.publicPage')}</Link></Button>
            <Button onClick={exportCsv} disabled={!list.length}><Download /> {t('admin.events.exportCsv')}</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <CategoryBadge category={e.category} />
        <EventStatusBadge status={e.status} />
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
          {t('admin.events.attendedOf', { attended: attendedCount, total: list.length })}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{t('events.reward', { count: e.points_reward })}</span>
      </div>

      <Card>
        {participants.isLoading && <div className="space-y-2 p-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>}
        {!participants.isLoading && list.length === 0 && <EmptyState icon={UserX} title={t('admin.events.noParticipants')} className="m-3" />}
        {list.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">{t('admin.events.cAttendance')}</TableHead>
                <TableHead>{t('admin.users.name')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('auth.email')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('admin.users.street')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('admin.events.cRegistered')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(({ participant, profile }) => {
                const attended = participant.status === 'attended';
                const cbId = `att-${profile.id}`;
                return (
                  <TableRow key={profile.id} className={cn(attended && 'bg-green-50 dark:bg-green-900/20')}>
                    <TableCell>
                      <label htmlFor={cbId} className="flex cursor-pointer items-center gap-2">
                        <input
                          id={cbId}
                          type="checkbox"
                          className="h-5 w-5 accent-[#2e7d32]"
                          checked={attended}
                          aria-label={`${t('admin.events.came')}: ${profile.last_name} ${profile.first_name}`}
                          disabled={setAttendance.isPending && setAttendance.variables?.userId === profile.id}
                          onChange={(ev) => setAttendance.mutate({ userId: profile.id, attended: ev.target.checked })}
                        />
                        <span className="text-xs">{t('admin.events.came')}</span>
                      </label>
                    </TableCell>
                    <TableCell className="font-medium">{profile.last_name} {profile.first_name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{profile.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{streetName(street(profile.street_id))}</TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">{fmtDateTime(participant.registered_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">{t('admin.events.attendanceHint')}</p>
    </div>
  );
}
