import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { FilterX, Inbox, Map as MapIcon, Table as TableIcon } from 'lucide-react';
import type { ReportFilters, ReportStatus, ReportType, Severity } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BaseMap } from '@/components/map/BaseMap';
import { clusterIcon, reportIcon } from '@/components/map/markers';
import { ReportStatusBadge, ReportTypeLabel, SeverityBadge } from '@/components/StatusBadges';
import { ReportPopupCard } from '@/features/map/MapPopups';
import { ReportDetailSheet } from '@/features/admin/ReportDetailSheet';
import { useReports } from '@/hooks/useReports';
import { REPORT_STATUSES, REPORT_TYPES, SEVERITIES, REPORT_TYPE_META } from '@/lib/domain';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type SortKey = NonNullable<ReportFilters['sort']>;

export default function ReportsAdminPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('id');
  const [view, setView] = useState<'table' | 'map'>('table');
  const [status, setStatus] = useState<ReportStatus | 'all'>('all');
  const [type, setType] = useState<ReportType | 'all'>('all');
  const [severity, setSeverity] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');

  const filters: ReportFilters = useMemo(
    () => ({
      statuses: status === 'all' ? undefined : [status],
      type,
      severity: severity === 'all' ? 'all' : (Number(severity) as Severity),
      from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
      sort,
    }),
    [status, type, severity, from, to, sort],
  );
  const { data, isLoading } = useReports(filters);

  const open = (id: string) => setParams((p) => { p.set('id', id); return p; });
  const close = () => setParams((p) => { p.delete('id'); return p; });
  const resetFilters = () => {
    setStatus('all'); setType('all'); setSeverity('all'); setFrom(''); setTo(''); setSort('date_desc');
  };
  const hasFilters = status !== 'all' || type !== 'all' || severity !== 'all' || from || to;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={t('admin.reports.title')}
        subtitle={data ? t('admin.reports.found', { count: data.length }) : undefined}
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'map')}>
            <TabsList>
              <TabsTrigger value="table"><TableIcon /> {t('admin.reports.viewTable')}</TabsTrigger>
              <TabsTrigger value="map"><MapIcon /> {t('admin.reports.viewMap')}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <Card className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4 xl:grid-cols-8">
        <div className="space-y-1">
          <Label htmlFor="f-status">{t('admin.reports.fStatus')}</Label>
          <SimpleSelect id="f-status" value={status} onValueChange={(v) => setStatus(v as ReportStatus | 'all')}
            options={[{ value: 'all', label: t('common.all') }, ...REPORT_STATUSES.map((s) => ({ value: s, label: t(`reportStatus.${s}`) }))]} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-type">{t('admin.reports.fType')}</Label>
          <SimpleSelect id="f-type" value={type} onValueChange={(v) => setType(v as ReportType | 'all')}
            options={[{ value: 'all', label: t('common.all') }, ...REPORT_TYPES.map((s) => ({ value: s, label: `${REPORT_TYPE_META[s].emoji} ${t(`reportType.${s}`)}` }))]} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-sev">{t('admin.reports.fSeverity')}</Label>
          <SimpleSelect id="f-sev" value={severity} onValueChange={setSeverity}
            options={[{ value: 'all', label: t('common.all') }, ...SEVERITIES.map((s) => ({ value: String(s), label: t(`severity.${s}`) }))]} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-from">{t('admin.reports.fFrom')}</Label>
          <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-to">{t('admin.reports.fTo')}</Label>
          <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-sort">{t('admin.reports.sort')}</Label>
          <SimpleSelect id="f-sort" value={sort} onValueChange={(v) => setSort(v as SortKey)}
            options={[
              { value: 'date_desc', label: t('admin.reports.sortNew') },
              { value: 'date_asc', label: t('admin.reports.sortOld') },
              { value: 'severity_desc', label: t('admin.reports.sortSeverity') },
            ]} />
        </div>
        <div className="flex items-end">
          <Button variant="ghost" className="w-full" onClick={resetFilters} disabled={!hasFilters}>
            <FilterX /> {t('common.reset')}
          </Button>
        </div>
      </Card>

      {view === 'table' ? (
        <Card>
          {isLoading && <div className="space-y-2 p-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>}
          {!isLoading && data?.length === 0 && <EmptyState icon={Inbox} title={t('admin.reports.empty')} className="m-3" />}
          {!!data?.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.reports.cDate')}</TableHead>
                  <TableHead>{t('admin.reports.cType')}</TableHead>
                  <TableHead>{t('admin.reports.cSeverity')}</TableHead>
                  <TableHead>{t('admin.reports.cStatus')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('admin.reports.cDescription')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    onClick={() => open(r.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(r.id); } }}
                    className={cn('cursor-pointer focus-visible:bg-accent focus-visible:outline-none', r.status === 'new' && 'bg-yellow-50 font-medium dark:bg-yellow-900/20')}
                    aria-label={`${t(`reportType.${r.type}`)}, ${t(`reportStatus.${r.status}`)}`}
                  >
                    <TableCell className="whitespace-nowrap">
                      {r.status === 'new' && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-yellow-500" aria-hidden />}
                      {fmtDateTime(r.created_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap"><ReportTypeLabel type={r.type} className="font-normal" /></TableCell>
                    <TableCell><SeverityBadge report={r} /></TableCell>
                    <TableCell><ReportStatusBadge status={r.status} /></TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground lg:table-cell">{r.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : (
        <div className="h-[65vh] overflow-hidden rounded-xl border">
          <BaseMap ariaLabel={t('admin.reports.mapAria')}>
            <MarkerClusterGroup iconCreateFunction={clusterIcon('reports')} maxClusterRadius={40}>
              {data?.map((r) => (
                <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r)}>
                  <Popup minWidth={240}>
                    <ReportPopupCard report={r} footer={<Button size="sm" className="w-full" onClick={() => open(r.id)}>{t('admin.reports.open')}</Button>} />
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </BaseMap>
        </div>
      )}

      <ReportDetailSheet reportId={selectedId} onClose={close} />
    </div>
  );
}
