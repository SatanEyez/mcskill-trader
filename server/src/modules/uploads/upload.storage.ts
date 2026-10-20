import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../../config/env.js';

/** Каталог загруженных изображений. Лежит вне client/dist — переживает пересборку фронта. */
export const UPLOADS_DIR = resolve(env.UPLOAD_DIR);
export const UPLOADS_URL_PREFIX = '/uploads';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

const EXTENSION_BY_MIME: Record<AllowedImageMime, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

mkdirSync(UPLOADS_DIR, { recursive: true });

export function isAllowedImageMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME as readonly string[]).includes(mime);
}

export function extensionForMime(mime: AllowedImageMime): string {
  return EXTENSION_BY_MIME[mime];
}

/**
 * Определяет формат по сигнатуре файла. Content-Type из запроса подделывается
 * тривиально, поэтому расширению и MIME из формы не доверяем.
 */
export function detectImageMime(buffer: Buffer): AllowedImageMime | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString('latin1');
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}
