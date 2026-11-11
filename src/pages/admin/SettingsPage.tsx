import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { Map as LeafletMap } from 'leaflet';
import { Check, Crosshair, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { BaseMap, MapRef } from '@/components/map/BaseMap';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  useCreateStreet, useDeleteStreet, useSettings, useStreets, useUpdateSettings, useUpdateStreet,
} from '@/hooks/useSettings';
import type { Street } from '@/types';

const villageSchema = z.object({
  name_ru: z.string().trim().min(1, 'validation.required').max(80, 'validation.tooLong'),
  name_kk: z.string().trim().min(1, 'validation.required').max(80, 'validation.tooLong'),
  population: z.coerce.number({ invalid_type_error: 'validation.number' }).int('validation.number').min(1, 'validation.number').max(1_000_000, 'validation.number'),
});
type VillageValues = z.infer<typeof villageSchema>;

function VillageForm() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<VillageValues>({ resolver: zodResolver(villageSchema) });
  useEffect(() => {
    if (settings) reset({ name_ru: settings.name_ru, name_kk: settings.name_kk, population: settings.population });
  }, [settings, reset]);
  const err = (m?: string) => (m ? t(m) : undefined);
  if (!settings) return <Skeleton className="h-48" />;
  return (
    <form onSubmit={handleSubmit((v) => update.mutate(v))} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('admin.settings.nameRu')} htmlFor="s-ru" error={err(errors.name_ru?.message)}>
          <Input id="s-ru" {...register('name_ru')} />
        </Field>
        <Field label={t('admin.settings.nameKk')} htmlFor="s-kk" error={err(errors.name_kk?.message)}>
          <Input id="s-kk" {...register('name_kk')} />
        </Field>
      </div>
      <Field label={t('admin.settings.population')} htmlFor="s-pop" error={err(errors.population?.message)} hint={t('admin.settings.populationHint')}>
        <Input id="s-pop" type="number" min={1} {...register('population')} className="sm:w-48" />
      </Field>
      <Button type="submit" disabled={update.isPending || !isDirty}>
        {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} {t('common.save')}
      </Button>
    </form>
  );
}

function MapViewEditor() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const mapRef = useRef<LeafletMap | null>(null);
  const [view, setView] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const onReady = useCallback((m: LeafletMap) => {
    mapRef.current = m;
    const sync = () => {
      const c = m.getCenter();
      setView({ lat: c.lat, lng: c.lng, zoom: m.getZoom() });
    };
    sync();
    m.on('moveend', sync);
  }, []);

  const save = () => {
    const m = mapRef.current;
    if (!m) return;
    const c = m.getCenter();
    const b = m.getBounds();
    update.mutate({
      center_lat: Number(c.lat.toFixed(6)),
      center_lng: Number(c.lng.toFixed(6)),
      default_zoom: m.getZoom(),
      bounds: [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]],
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('admin.settings.mapHint')}</p>
      <div className="relative h-80 overflow-hidden rounded-lg border">
        {settings ? (
          <BaseMap ariaLabel={t('admin.settings.mapView')}>
            <MapRef onReady={onReady} />
          </BaseMap>
        ) : <Skeleton className="h-full" />}
        <Crosshair className="pointer-events-none absolute left-1/2 top-1/2 z-[500] h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-red-600" aria-hidden />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} {t('admin.settings.saveView')}
        </Button>
        {view && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {view.lat.toFixed(5)}, {view.lng.toFixed(5)} · {t('admin.settings.zoom')} {view.zoom}
          </span>
        )}
      </div>
    </div>
  );
}

function StreetRow({ street, onDelete }: { street: Street; onDelete: (s: Street) => void }) {
  const { t } = useTranslation();
  const update = useUpdateStreet();
  const [editing, setEditing] = useState(false);
  const [ru, setRu] = useState(street.name_ru);
  const [kk, setKk] = useState(street.name_kk);
  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-2 sm:flex-row">
        <Input value={ru} onChange={(e) => setRu(e.target.value)} aria-label={t('admin.settings.streetRu')} />
        <Input value={kk} onChange={(e) => setKk(e.target.value)} aria-label={t('admin.settings.streetKk')} />
        <div className="flex gap-1">
          <Button
            size="icon"
            aria-label={t('common.save')}
            disabled={!ru.trim() || !kk.trim() || update.isPending}
            onClick={() => update.mutate({ id: street.id, input: { name_ru: ru, name_kk: kk } }, { onSuccess: () => setEditing(false) })}
          >
            <Check />
          </Button>
          <Button size="icon" variant="ghost" aria-label={t('common.cancel')} onClick={() => { setEditing(false); setRu(street.name_ru); setKk(street.name_kk); }}>
            <X />
          </Button>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{street.name_ru}</p>
        <p className="text-sm text-muted-foreground">{street.name_kk}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={t('admin.settings.editStreet', { name: street.name_ru })}><Pencil /></Button>
      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(street)} aria-label={t('admin.settings.deleteStreet', { name: street.name_ru })}><Trash2 /></Button>
    </li>
  );
}

function StreetsEditor() {
  const { t } = useTranslation();
  const { data: streets, isLoading } = useStreets();
  const create = useCreateStreet();
  const del = useDeleteStreet();
  const [ru, setRu] = useState('');
  const [kk, setKk] = useState('');
  const [toDelete, setToDelete] = useState<Street | null>(null);

  return (
    <div className="space-y-3">
      {isLoading && <Skeleton className="h-40" />}
      <ul className="divide-y">
        {streets?.map((s) => <StreetRow key={s.id} street={s} onDelete={setToDelete} />)}
      </ul>
      <form
        className="flex flex-col gap-2 border-t pt-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ru.trim() || !kk.trim()) return;
          create.mutate({ name_ru: ru, name_kk: kk }, { onSuccess: () => { setRu(''); setKk(''); } });
        }}
      >
        <Input placeholder={t('admin.settings.streetRu')} aria-label={t('admin.settings.streetRu')} value={ru} onChange={(e) => setRu(e.target.value)} />
        <Input placeholder={t('admin.settings.streetKk')} aria-label={t('admin.settings.streetKk')} value={kk} onChange={(e) => setKk(e.target.value)} />
        <Button type="submit" disabled={!ru.trim() || !kk.trim() || create.isPending}><Plus /> {t('admin.settings.addStreet')}</Button>
      </form>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('admin.settings.deleteConfirm', { name: toDelete?.name_ru ?? '' })}
        description={t('admin.settings.deleteConfirmText')}
        confirmLabel={t('common.delete')}
        destructive
        pending={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl space-y-4 p-4 md:p-6">
      <PageHeader title={t('admin.settings.title')} />
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.settings.village')}</CardTitle></CardHeader>
        <CardContent><VillageForm /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.settings.mapView')}</CardTitle></CardHeader>
        <CardContent><MapViewEditor /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.settings.streets')}</CardTitle></CardHeader>
        <CardContent><StreetsEditor /></CardContent>
      </Card>
    </div>
  );
}
