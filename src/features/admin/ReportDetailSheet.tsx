import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Marker } from 'react-leaflet';
import { Brush, ImagePlus, Loader2, Mail, Save, User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/misc';
import { BaseMap } from '@/components/map/BaseMap';
import { reportIcon } from '@/components/map/markers';
import { PhotoGallery } from '@/components/PhotoLightbox';
import { ReportStatusBadge, ReportTypeLabel, SeverityBadge } from '@/components/StatusBadges';
import { ReportHistoryList } from '@/features/reports/ReportTimeline';
import { useReport, useSetReportStatus, useSetResolvedPhoto, useUploadPhoto } from '@/hooks/useReports';
import { REPORT_STATUSES } from '@/lib/domain';
import { fmtDateTime } from '@/lib/format';
import type { ReportStatus } from '@/types';

export function ReportDetailSheet({ reportId, onClose }: { reportId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useReport(reportId);
  const setStatus = useSetReportStatus();
  const setPhoto = useSetResolvedPhoto();
  const upload = useUploadPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatusValue] = useState<ReportStatus>('new');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (data) {
      setStatusValue(data.report.status);
      setComment('');
    }
  }, [data]);

  const r = data?.report;

  return (
    <Dialog open={!!reportId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{r ? <ReportTypeLabel type={r.type} /> : t('admin.reports.card')}</DialogTitle>
          {r && <DialogDescription>{fmtDateTime(r.created_at)}</DialogDescription>}
        </DialogHeader>
        {isLoading || !r ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <ReportStatusBadge status={r.status} />
              <SeverityBadge report={r} />
            </div>
            <p className="whitespace-pre-line">{r.description}</p>
            <PhotoGallery photos={r.photo_urls} label={t('admin.reports.photos')} />

            {data.author && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-1 font-medium">{t('admin.reports.author')}</p>
                <p className="flex items-center gap-2"><User className="h-4 w-4" aria-hidden /> {data.author.first_name} {data.author.last_name}</p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" aria-hidden /> <a href={`mailto:${data.author.email}`} className="hover:underline">{data.author.email}</a>
                </p>
              </div>
            )}

            <div className="h-48 overflow-hidden rounded-lg border">
              <BaseMap ariaLabel={t('admin.reports.mapAria')} center={[r.lat, r.lng]} zoom={17} scrollWheelZoom={false}>
                <Marker position={[r.lat, r.lng]} icon={reportIcon(r)} />
              </BaseMap>
            </div>

            <section className="space-y-3 rounded-lg border p-3">
              <h3 className="font-semibold">{t('admin.reports.actions')}</h3>
              <div className="space-y-1.5">
                <Label htmlFor="rp-status">{t('admin.reports.changeStatus')}</Label>
                <SimpleSelect
                  id="rp-status"
                  value={status}
                  onValueChange={(v) => setStatusValue(v as ReportStatus)}
                  options={REPORT_STATUSES.map((s) => ({ value: s, label: t(`reportStatus.${s}`) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-comment">{t('admin.reports.comment')}</Label>
                <Textarea id="rp-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('admin.reports.commentPlaceholder')} maxLength={500} />
              </div>
              <Button
                className="w-full"
                disabled={setStatus.isPending || (status === r.status && !comment.trim())}
                onClick={() => setStatus.mutate({ id: r.id, status, comment: comment.trim() || null }, { onSuccess: () => setComment('') })}
              >
                {setStatus.isPending ? <Loader2 className="animate-spin" /> : <Save />} {t('common.save')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('admin.reports.pointsHint')}</p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold">{t('admin.reports.afterPhoto')}</h3>
              {r.resolved_photo_url ? (
                <PhotoGallery photos={[r.resolved_photo_url]} label={t('admin.reports.afterPhoto')} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('admin.reports.noAfterPhoto')}</p>
              )}
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={upload.isPending || setPhoto.isPending}>
                {upload.isPending || setPhoto.isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />} {t('admin.reports.uploadAfter')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate(f, { onSuccess: (url) => setPhoto.mutate({ id: r.id, url }) });
                  e.target.value = '';
                }}
              />
            </section>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                navigate('/admin/map', {
                  state: {
                    createAt: { lat: r.lat, lng: r.lng },
                    category: 'cleanup',
                    title: t('admin.reports.cleanupTitle'),
                  },
                })
              }
            >
              <Brush /> {t('admin.reports.createCleanup')}
            </Button>

            <section className="space-y-2">
              <h3 className="font-semibold">{t('admin.reports.history')}</h3>
              <ReportHistoryList history={data.history} />
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
