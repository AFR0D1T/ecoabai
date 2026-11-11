import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Миниатюры + полноэкранный просмотр с листанием. */
export function PhotoGallery({ photos, label }: { photos: string[]; label: string }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return null;
  const go = (d: number) => setIndex((i) => (i === null ? i : (i + d + photos.length) % photos.length));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className="overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('lightbox.open', { n: i + 1, label })}
          >
            <img src={p} alt="" className="h-20 w-24 object-cover transition-transform hover:scale-105" />
          </button>
        ))}
      </div>
      <Dialog open={index !== null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent
          className="max-w-4xl bg-black/95 p-2 text-white"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          {index !== null && (
            <div className="relative flex items-center justify-center">
              <img src={photos[index]} alt={t('lightbox.photoOf', { n: index + 1, total: photos.length })} className="max-h-[80vh] w-auto rounded" />
              {photos.length > 1 && (
                <>
                  <Button variant="secondary" size="icon" className="absolute left-2 rounded-full" onClick={() => go(-1)} aria-label={t('lightbox.prev')}>
                    <ChevronLeft />
                  </Button>
                  <Button variant="secondary" size="icon" className="absolute right-2 rounded-full" onClick={() => go(1)} aria-label={t('lightbox.next')}>
                    <ChevronRight />
                  </Button>
                </>
              )}
              <p className="absolute bottom-2 rounded bg-black/60 px-2 text-sm">{index + 1} / {photos.length}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
