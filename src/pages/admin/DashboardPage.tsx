import { useTranslation } from 'react-i18next';
import { CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { Activity, CalendarCheck, Clock, Users, MessageSquareWarning, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { BaseMap } from '@/components/map/BaseMap';
import { useDashboardStats } from '@/hooks/useCommunity';
import { dateLocale, fmtNumber, fmtPercent } from '@/lib/format';
import { STATUS_COLOR, REPORT_TYPE_META } from '@/lib/domain';

const C = { green: '#43a047', orange: '#ef6c00', blue: '#1e88e5', grey: '#9e9e9e' };

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden /> {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64 text-xs text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

const axis = { stroke: 'currentColor', tick: { fill: 'currentColor', fontSize: 11 }, tickLine: false } as const;
const tooltipStyle = { contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' } };

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: s, isLoading } = useDashboardStats();
  const monthLabel = (m: string) => format(new Date(`${m}-01T00:00:00`), 'LLL', { locale: dateLocale() });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title={t('admin.dashboard.title')} />
      {isLoading || !s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={Users}
              label={t('admin.dashboard.registered')}
              value={fmtNumber(s.registered)}
              sub={t('admin.dashboard.ofPopulation', { pct: fmtPercent(s.population ? s.registered / s.population : 0), population: fmtNumber(s.population) })}
            />
            <Kpi icon={Activity} label={t('admin.dashboard.active')} value={`${s.active_7d} / ${s.active_30d}`} sub={t('admin.dashboard.activeSub')} />
            <Kpi
              icon={MessageSquareWarning}
              label={t('admin.dashboard.reports')}
              value={`${s.reports_new} / ${s.reports_in_progress}`}
              sub={t('admin.dashboard.reportsSub', { resolved: s.reports_resolved_month })}
            />
            <Kpi
              icon={Clock}
              label={t('admin.dashboard.avgResolution')}
              value={s.avg_resolution_hours === null ? '—' : s.avg_resolution_hours >= 48 ? t('admin.dashboard.days', { count: Math.round(s.avg_resolution_hours / 24) }) : t('admin.dashboard.hours', { count: Math.round(s.avg_resolution_hours) })}
            />
            <Kpi icon={CalendarCheck} label={t('admin.dashboard.eventsMonth')} value={fmtNumber(s.events_month)} />
            <Kpi icon={Users} label={t('admin.dashboard.participants')} value={fmtNumber(s.participants_total)} />
            <Kpi icon={Percent} label={t('admin.dashboard.attendance')} value={s.attendance_rate === null ? '—' : fmtPercent(s.attendance_rate)} sub={t('admin.dashboard.attendanceSub')} />
            <Kpi icon={Users} label={t('admin.dashboard.population')} value={fmtNumber(s.population)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title={t('admin.dashboard.chartRegistrations')}>
              <ResponsiveContainer>
                <BarChart data={s.registrations_by_week}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="week" {...axis} />
                  <YAxis allowDecimals={false} {...axis} width={28} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [v, t('admin.dashboard.newUsers')]} />
                  <Bar dataKey="count" fill={C.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t('admin.dashboard.chartByType')}>
              <ResponsiveContainer>
                <BarChart data={s.reports_by_type.map((r) => ({ ...r, label: `${REPORT_TYPE_META[r.type].emoji} ${t(`reportType.${r.type}`)}` }))} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis type="number" allowDecimals={false} {...axis} />
                  <YAxis type="category" dataKey="label" width={140} {...axis} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [v, t('admin.dashboard.count')]} />
                  <Bar dataKey="count" fill={C.orange} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t('admin.dashboard.chartByMonth')}>
              <ResponsiveContainer>
                <LineChart data={s.reports_by_month}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} />
                  <YAxis allowDecimals={false} {...axis} width={28} />
                  <Tooltip {...tooltipStyle} labelFormatter={(m: string) => monthLabel(m)} />
                  <Legend />
                  <Line type="monotone" dataKey="created" name={t('admin.dashboard.created')} stroke={C.orange} strokeWidth={2} dot />
                  <Line type="monotone" dataKey="resolved" name={t('admin.dashboard.resolved')} stroke={C.green} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={t('admin.dashboard.chartParticipation')}>
              <ResponsiveContainer>
                <BarChart data={s.participation_by_month}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} {...axis} />
                  <YAxis allowDecimals={false} {...axis} width={28} />
                  <Tooltip {...tooltipStyle} labelFormatter={(m: string) => monthLabel(m)} />
                  <Legend />
                  <Bar dataKey="registered" name={t('admin.dashboard.registeredP')} fill={C.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="attended" name={t('admin.dashboard.attendedP')} fill={C.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t('admin.dashboard.hotspots')}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80 overflow-hidden rounded-lg border">
                  <BaseMap ariaLabel={t('admin.dashboard.hotspots')}>
                    {s.hotspots.map((h, i) => (
                      <CircleMarker
                        key={i}
                        center={[h.lat, h.lng]}
                        radius={10 + h.weight * 8}
                        pathOptions={{ color: STATUS_COLOR[h.status], fillColor: h.status === 'resolved' ? STATUS_COLOR.resolved : '#e53935', fillOpacity: h.status === 'resolved' ? 0.15 : 0.12 + h.weight * 0.08, weight: 1 }}
                      >
                        <LeafletTooltip>{t(`reportStatus.${h.status}`)} · {t(`severity.${h.weight}`)}</LeafletTooltip>
                      </CircleMarker>
                    ))}
                  </BaseMap>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
