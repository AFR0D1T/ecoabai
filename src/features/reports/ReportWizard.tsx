import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Marker } from 'react-leaflet';
import type L from 'leaflet';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Camera, CheckCircle2, ImagePlus, Loader2, LocateFixed, Phone, Send, Trash2, TriangleAlert,
} from 'lucide-react';
import { BaseMap, FlyTo, MapClickHandler } from '@/components/map/BaseMap';
import { pointIcon } from '@/components/map/markers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FieldError, Label, Textarea } from '@/components/ui/input';
import { useCreateReport, useUploadPhoto } from '@/hooks/useReports';
import { MAX_REPORT_PHOTOS, REPORT_DESCRIPTION_MAX } from '@/config';
import { REPORT_TYPES, REPORT_TYPE_META, SEVERITIES } from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { ReportType, Severity } from '@/types';

const PHOTO_REQUIRED: ReportType[] = ['illegal_dump', 'toxic_release'];

const schema = z
  .object({
    lat: z.number({ required_error: 'report.errors.location', invalid_type_error: 'report.errors.location' }),
    lng: z.number({ required_error: 'report.errors.location', invalid_type_error: 'report.errors.location' }),
    type: z.enum(['illegal_dump', 'toxic_release', 'overflowing_bin', 'burning', 'water_pollution', 'other'], {
      required_error: 'report.errors.type',
      invalid_type_error: 'report.errors.type',
    }),
    severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    description: z
      .string()
      .trim()
      .min(5, 'report.errors.descriptionShort')
      .max(REPORT_DESCRIPTION_MAX, 'report.errors.descriptionLong'),
    photo_urls: z.array(z.string()).max(MAX_REPORT_PHOTOS),
  })
  .superRefine((v, ctx) => {
    if (PHOTO_REQUIRED.includes(v.type) && v.photo_urls.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['photo_urls'], message: 'report.errors.photoRequired' });
    }
  });

type FormValues = z.infer<typeof schema>;

const STEP_FIELDS: (keyof FormValues)[][] = [['lat', 'lng'], ['type', 'severity', 'description'], ['photo_urls']];

export function ReportWizard() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const upload = useUploadPhoto();
  const create = useCreateReport();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { severity: 2, description: '', photo_urls: [] } as Partial<FormValues>,
    mode: 'onTouched',
  });
  const { control, watch, setValue, trigger, handleSubmit, formState } = form;
  const lat = watch('lat');
  const lng = watch('lng');
  const type = watch('type');
  const photos = watch('photo_urls');
  const description = watch('description') ?? '';
  const errMsg = (k: keyof FormValues) => {
    const m = formState.errors[k]?.message;
    return m ? t(m) : undefined;
  };

  const setPoint = (la: number, ln: number) => {
    setValue('lat', la, { shouldValidate: true });
    setValue('lng', ln, { shouldValidate: true });
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      toast.error(t('report.geoUnavailable'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPoint(pos.coords.latitude, pos.coords.longitude);
        setFlyTarget([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setLocating(false);
        toast.error(t('report.geoDenied'));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_REPORT_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.warning(t('report.maxPhotos', { count: MAX_REPORT_PHOTOS }));
    for (const f of list) {
      try {
        const url = await upload.mutateAsync(f);
        setValue('photo_urls', [...form.getValues('photo_urls'), url], { shouldValidate: true });
      } catch {
        /* тост показан глобально */
      }
    }
  };

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step]);
    if (ok) setStep((s) => s + 1);
  };

  const onSubmit = handleSubmit((v) =>
    create.mutate(
      { ...v, description: v.description.trim(), severity: v.severity as Severity },
      { onSuccess: (r) => setCreatedId(r.id) },
    ),
  );

  if (createdId) {
    return (
      <Card className="mx-auto max-w-lg p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">{t('report.thanksTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('report.thanksText')}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to={`/profile#report-${createdId}`}>{t('report.viewStatus')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">{t('report.toMap')}</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const stepTitles = [t('report.step1'), t('report.step2'), t('report.step3')];
  const needsPhoto = type ? PHOTO_REQUIRED.includes(type) : false;

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-2xl flex-col gap-4" noValidate>
      <div>
        <h1 className="text-2xl font-bold">{t('report.title')}</h1>
        <ol className="mt-3 grid grid-cols-3 gap-2" aria-label={t('report.progress')}>
          {stepTitles.map((title, i) => (
            <li key={title} aria-current={i === step ? 'step' : undefined} className="space-y-1">
              <div className={cn('h-1.5 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
              <p className={cn('text-xs', i === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {i + 1}. {title}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <section className="space-y-3" aria-labelledby="step1">
          <h2 id="step1" className="text-lg font-semibold">{t('report.whereTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('report.whereHint')}</p>
          <div className="relative -mx-4 h-[52dvh] min-h-[300px] overflow-hidden border-y sm:mx-0 sm:h-[45vh] sm:rounded-xl sm:border">
            <BaseMap ariaLabel={t('report.mapAria')}>
              <MapClickHandler onClick={(e) => setPoint(e.latlng.lat, e.latlng.lng)} />
              <FlyTo position={flyTarget} />
              {lat !== undefined && lng !== undefined && (
                <Marker
                  position={[lat, lng]}
                  icon={pointIcon()}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const p = (e.target as L.Marker).getLatLng();
                      setPoint(p.lat, p.lng);
                    },
                  }}
                />
              )}
            </BaseMap>
            {/* кнопка геолокации прямо на карте — под большим пальцем */}
            <Button
              type="button"
              variant="outline"
              className="absolute bottom-6 right-3 z-[450] rounded-full shadow-lg"
              onClick={locate}
              disabled={locating}
            >
              {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} {t('report.myLocation')}
            </Button>
          </div>
          <FieldError message={errMsg('lat')} />
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4" aria-labelledby="step2">
          <h2 id="step2" className="text-lg font-semibold">{t('report.whatTitle')}</h2>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t('report.type')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {REPORT_TYPES.map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    role="radio"
                    aria-checked={field.value === rt}
                    onClick={() => field.onChange(rt)}
                    className={cn(
                      'flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 bg-card p-3 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      field.value === rt ? 'border-primary bg-secondary' : 'border-border hover:bg-accent',
                    )}
                  >
                    <span className="text-3xl" aria-hidden>{REPORT_TYPE_META[rt].emoji}</span>
                    {t(`reportType.${rt}`)}
                  </button>
                ))}
              </div>
            )}
          />
          <FieldError message={errMsg('type')} />

          {type === 'toxic_release' && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border-2 border-red-500 bg-red-50 p-3 text-red-900 dark:bg-red-950/50 dark:text-red-100">
              <Phone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="text-sm font-medium">{t('report.call112')}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label id="sev-label">{t('report.severity')}</Label>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <div role="radiogroup" aria-labelledby="sev-label" className="grid grid-cols-3 gap-2">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={field.value === s}
                      onClick={() => field.onChange(s)}
                      className={cn(
                        'h-12 rounded-lg border-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        field.value === s
                          ? s === 3 ? 'border-red-600 bg-red-600 text-white' : 'border-primary bg-secondary'
                          : 'border-border bg-card hover:bg-accent',
                      )}
                    >
                      {t(`severity.${s}`)}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <Field label={t('report.description')} htmlFor="desc" error={errMsg('description')}>
            <Textarea
              id="desc"
              rows={4}
              maxLength={REPORT_DESCRIPTION_MAX}
              placeholder={t('report.descriptionPlaceholder')}
              aria-invalid={!!formState.errors.description}
              {...form.register('description')}
            />
            <p className="text-right text-xs text-muted-foreground" aria-live="polite">
              {description.length} / {REPORT_DESCRIPTION_MAX}
            </p>
          </Field>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3" aria-labelledby="step3">
          <h2 id="step3" className="text-lg font-semibold">{t('report.photosTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {needsPhoto ? t('report.photosRequiredHint') : t('report.photosHint')} {t('report.maxPhotos', { count: MAX_REPORT_PHOTOS })}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div key={url.slice(-40) + i} className="relative aspect-square overflow-hidden rounded-lg border">
                <img src={url} alt={t('report.photoN', { n: i + 1 })} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  onClick={() => setValue('photo_urls', photos.filter((_, j) => j !== i), { shouldValidate: true })}
                  aria-label={t('report.removePhoto', { n: i + 1 })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {upload.isPending && (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed" role="status">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label={t('report.uploading')} />
              </div>
            )}
          </div>
          {photos.length < MAX_REPORT_PHOTOS && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => cameraRef.current?.click()} disabled={upload.isPending}>
                <Camera /> {t('report.camera')}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => galleryRef.current?.click()} disabled={upload.isPending}>
                <ImagePlus /> {t('report.gallery')}
              </Button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
              <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
            </div>
          )}
          <FieldError message={errMsg('photo_urls')} />
          {type === 'toxic_release' && (
            <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
              <TriangleAlert className="h-4 w-4" aria-hidden /> {t('report.call112')}
            </p>
          )}
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        {step > 0 && (
          <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft /> {t('common.back')}
          </Button>
        )}
        {step < 2 ? (
          <Button type="button" size="lg" className="flex-1" onClick={() => void next()}>
            {t('common.next')} <ArrowRight />
          </Button>
        ) : (
          <Button type="submit" size="lg" className="flex-1" disabled={create.isPending || upload.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Send />} {t('report.submit')}
          </Button>
        )}
      </div>
    </form>
  );
}
