import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX, Copy, MoreVertical, Pencil, Plus, Users, XCircle } from 'lucide-react';
import type { EcoEvent, EventStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SimpleSelect } from '@/components/ui/select';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CategoryBadge, EventStatusBadge } from '@/components/StatusBadges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EventFormSheet, type EventFormInitial } from '@/features/admin/EventFormSheet';
import { useCancelEvent, useDuplicateEvent, useEvents } from '@/hooks/useEvents';
import { useSettings } from '@/hooks/useSettings';
import { EVENT_STATUSES } from '@/lib/domain';
import { fmtDateTime } from '@/lib/format';
import { DEFAULT_MAP_CENTER } from '@/config';

export default function EventsAdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<EventStatus | 'all'>('all');
  const { data, isLoading } = useEvents({ scope: 'all', statuses: status === 'all' ? undefined : [status] });
  const { data: settings } = useSettings();
  const cancel = useCancelEvent();
  const duplicate = useDuplicateEvent();
  const [form, setForm] = useState<EventFormInitial | null>(null);
  const [toCancel, setToCancel] = useState<EcoEvent | null>(null);

  const sorted = [...(data ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const createNew = () =>
    setForm({ lat: settings?.center_lat ?? DEFAULT_MAP_CENTER.lat, lng: settings?.center_lng ?? DEFAULT_MAP_CENTER.lng });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={t('admin.events.title')}
        actions={
          <>
            <SimpleSelect
              className="w-44"
              ariaLabel={t('admin.events.fStatus')}
              value={status}
              onValueChange={(v) => setStatus(v as EventStatus | 'all')}
              options={[{ value: 'all', label: t('common.all') }, ...EVENT_STATUSES.map((s) => ({ value: s, label: t(`eventStatus.${s}`) }))]}
            />
            <Button onClick={createNew}><Plus /> {t('admin.events.create')}</Button>
          </>
        }
      />
      <p className="text-sm text-muted-foreground">{t('admin.events.mapHint')} <Link to="/admin/map" className="text-primary hover:underline">{t('admin.nav.map')}</Link></p>

      <Card>
        {isLoading && <div className="space-y-2 p-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>}
        {!isLoading && sorted.length === 0 && <EmptyState icon={CalendarX} title={t('admin.events.empty')} className="m-3" />}
        {sorted.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.events.cTitle')}</TableHead>
                <TableHead>{t('admin.events.cDate')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('admin.events.cCategory')}</TableHead>
                <TableHead>{t('admin.events.cStatus')}</TableHead>
                <TableHead className="text-right">{t('admin.events.cParticipants')}</TableHead>
                <TableHead><span className="sr-only">{t('admin.events.actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-[16rem]">
                    <Link to={`/admin/events/${e.id}`} className="line-clamp-2 font-medium hover:underline">{e.title}</Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(e.starts_at)}</TableCell>
                  <TableCell className="hidden md:table-cell"><CategoryBadge category={e.category} /></TableCell>
                  <TableCell><EventStatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.participants_count}{e.max_participants !== null && ` / ${e.max_participants}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('admin.events.actionsFor', { title: e.title })}>
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => navigate(`/admin/events/${e.id}`)}><Users /> {t('admin.events.participants')}</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setForm({ ...e })}><Pencil /> {t('common.edit')}</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => duplicate.mutate(e.id)}><Copy /> {t('admin.events.duplicate')}</DropdownMenuItem>
                        {(e.status === 'published' || e.status === 'draft') && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setToCancel(e)}>
                              <XCircle /> {t('admin.events.cancel')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <EventFormSheet open={!!form} onOpenChange={(o) => !o && setForm(null)} initial={form} />
      <ConfirmDialog
        open={!!toCancel}
        onOpenChange={(o) => !o && setToCancel(null)}
        title={t('admin.events.cancelConfirmTitle')}
        description={toCancel ? t('admin.events.cancelConfirmText', { title: toCancel.title, count: toCancel.participants_count }) : undefined}
        confirmLabel={t('admin.events.cancel')}
        destructive
        pending={cancel.isPending}
        onConfirm={() => toCancel && cancel.mutate(toCancel.id, { onSuccess: () => setToCancel(null) })}
      />
    </div>
  );
}
