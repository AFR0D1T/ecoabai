/**
 * Загрузка фото: сжимаем на клиенте до 1600 px (экономия трафика), сервер ещё раз проверяет файл,
 * перекодирует в JPEG и удаляет EXIF/GPS. Возвращает относительный URL вида /api/uploads/<id>.jpg.
 */
import { compressImage } from '@/lib/image';
import { ApiError } from './errors';
import { http } from './http';

export async function uploadPhoto(file: File): Promise<string> {
  let blob: Blob;
  try {
    blob = await compressImage(file);
  } catch {
    throw new ApiError('upload_failed');
  }
  const form = new FormData();
  form.append('file', blob, 'photo.jpg');
  const { url } = await http.upload<{ url: string }>('/uploads', form);
  return url;
}
