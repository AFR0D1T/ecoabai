import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Loader2, MapPin, Save, Send, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { useCreateEvent, useUpdateEvent } from '@/hooks/useEvents';
import { useUploadPhoto } from '@/hooks/useReports';
import { DEFAULT_EVENT_POINTS } from '@/config';
import { CATEGORY_META, EVENT_CATEGORIES } from '@/lib/domain';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import type { EventCategory, EventInput, EventStatus } from '@/types';

const schema = z
  .object({
    title: z.string().trim().min(3, 'validation.titleMin').max(120, 'validation.tooLong'),
    description: z.string().trim().max(2000, 'validation.tooLong'),
    category: z.enum(['cleanup', 'tree_planting', 'recycling', 'lecture', 'other']),
    starts_at: z.string().min(1, 'validation.required'),
    ends_at: z.string(),
    address: z.string().trim().max(200, 'validation.tooLong'),
    max_participants: z.string().regex(/^\d*$/, 'validation.number'),
    points_reward: z.coerce.number({ invalid_type_error: 'validation.number' }).int('validation.number').min(0, 'validation.number').max(500, 'validation.number'),
    cover_url: z.string().nullable(),
  })
  .refine((v) => !v.ends_at || new Date(v.ends_at) > new Date(v.starts_at), { path: ['ends_at'], message: 'validation.endAfterStart' });

type FormValues = z.infer<typeof schema>;

export interface EventFormInitial extends Partial<EventInput> {
  id?: string;
  lat: number;
  lng: number;
}

export function EventFormSheet({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: EventFormInitial | null;
  onSaved?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const upload = useUploadPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<EventStatus>('draft');

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!open || !initial) return;
    const tomorrow = new Date(Date.now() + 86_400_000);
    tomorrow.setHours(10, 0, 0, 0);
    reset({
      title: initial.title ?? '',
      description: initial.description ?? '',
      category: initial.category ?? 'cleanup',
      starts_at: toLocalInput(initial.starts_at ?? tomorrow.toISOString()),
      ends_at: toLocalInput(initial.ends_at ?? null),
      address: initial.address ?? '',
      max_participants: initial.max_participants != null ? String(initial.max_participants) : '',
      points_reward: initial.points_reward ?? DEFAULT_EVENT_POINTS,
      cover_url: initial.cover_url ?? null,
    });
  }, [open, initial, reset]);

  const cover = watch('cover_url');
  const err = (m?: string) => (m ? t(m) : undefined);
  const pending = create.isPending || update.isPending;

  const submit = (status: EventStatus) => {
    statusRef.current = status;
    void handleSubmit((v) => {
      if (!initial) return;
      const input: EventInput = {
        title: v.title.trim(),
        description: v.description.trim(),
        category: v.category,
        status: statusRef.current,
        starts_at: fromLocalInput(v.starts_at) as string,
        ends_at: fromLocalInput(v.ends_at),
        lat: initial.lat,
        lng: initial.lng,
        address: v.address.trim() || null,
        max_participants: v.max_participants ? Number(v.max_participants) : null,
        cover_url: v.cover_url,
        points_reward: v.points_reward,
      };
      const done = { onSuccess: (e: { id: string }) => { onOpenChange(false); onSaved?.(e.id); } };
      if (initial.id) update.mutate({ id: initial.id, patch: input }, done);
      else create.mutate(input, done);
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right">
        <DialogHeader>
          <DialogTitle>{initial?.id ? t('admin.events.editTitle') : t('admin.events.createTitle')}</DialogTitle>
          {initial && (
            <DialogDescription className="flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden /> {initial.lat.toFixed(5)}, {initial.lng.toFixed(5)}
            </DialogDescription>
          )}
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit('published'); }} noValidate>
          <Field label={t('admin.events.fTitle')} htmlFor="ev-title" error={err(errors.title?.message)}>
            <Input id="ev-title" {...register('title')} aria-invalid={!!errors.title} />
          </Field>
          <Field label={t('admin.events.fDescription')} htmlFor="ev-desc" error={err(errors.description?.message)}>
            <Textarea id="ev-desc" rows={4} {...register('description')} />
          </Field>
          <Field label={t('admin.events.fCategory')} htmlFor="ev-cat">
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <SimpleSelect
                  id="ev-cat"
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as EventCategory)}
                  options={EVENT_CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_META[c].emoji} ${t(`eventCategory.${c}`)}` }))}
                />
              )}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('admin.events.fStart')} htmlFor="ev-start" error={err(errors.starts_at?.message)}>
              <Input id="ev-start" type="datetime-local" {...register('starts_at')} aria-invalid={!!errors.starts_at} />
            </Field>
            <Field label={t('admin.events.fEnd')} htmlFor="ev-end" error={err(errors.ends_at?.message)}>
              <Input id="ev-end" type="datetime-local" {...register('ends_at')} aria-invalid={!!errors.ends_at} />
            </Field>
          </div>
          <Field label={t('admin.events.fAddress')} htmlFor="ev-addr" error={err(errors.address?.message)}>
            <Input id="ev-addr" {...register('address')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('admin.events.fLimit')} htmlFor="ev-limit" error={err(errors.max_participants?.message)} hint={t('admin.events.fLimitHint')}>
              <Input id="ev-limit" inputMode="numeric" {...register('max_participants')} />
            </Field>
            <Field label={t('admin.events.fPoints')} htmlFor="ev-points" error={err(errors.points_reward?.message)}>
              <Input id="ev-points" type="number" min={0} max={500} {...register('points_reward')} />
            </Field>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('admin.events.fCover')}</p>
            {cover ? (
              <div className="relative">
                <img src={cover} alt="" className="aspect-video w-full rounded-lg object-cover" />
                <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2" onClick={() => setValue('cover_url', null)} aria-label={t('admin.events.removeCover')}>
                  <Trash2 />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
                {upload.isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />} {t('admin.events.uploadCover')}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f, { onSuccess: (url) => setValue('cover_url', url) });
                e.target.value = '';
              }}
            />
          </div>
          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t bg-card px-5 py-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => submit('draft')} disabled={pending}>
              <Save /> {t('admin.events.saveDraft')}
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />} {t('admin.events.publish')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
