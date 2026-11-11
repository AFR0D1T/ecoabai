import { PHOTO_MAX_SIDE } from '@/config';

/** Сжимает изображение на клиенте до maxSide по длинной стороне (JPEG). */
export async function compressImage(file: File, maxSide = PHOTO_MAX_SIDE, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('not_an_image');
  const bitmap = await loadBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress_failed'))), 'image/jpeg', quality);
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fallback ниже */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_load_failed'));
    };
    img.src = url;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('read_failed'));
    r.readAsDataURL(blob);
  });
}
