import { BadRequestException } from '@nestjs/common';
import sharp, { type Metadata } from 'sharp';

export type OptimizedImage = {
  buffer: Buffer;
  mime: 'image/webp';
  ext: 'webp';
};

export class ImageOptimizeError extends Error {
  constructor() {
    super('Không đọc được ảnh');
    this.name = 'ImageOptimizeError';
  }
}

/**
 * Nén ảnh tải lên và luôn lưu WebP.
 * JPEG / PNG / WebP / GIF (kể cả GIF động) đều ra WebP; cạnh dài bị giới hạn `maxEdge`.
 */
export async function optimizeUploadImage(
  input: Buffer,
  options: { maxEdge: number; quality?: number },
): Promise<OptimizedImage> {
  const quality = options.quality ?? 80;
  const maxEdge = options.maxEdge;

  let meta: Metadata;
  try {
    meta = await sharp(input, { animated: true, limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new ImageOptimizeError();
  }
  if (!meta.format || !meta.width) throw new ImageOptimizeError();

  const frameHeight = meta.pageHeight ?? meta.height ?? 0;
  let pipeline = sharp(input, { animated: true, limitInputPixels: 40_000_000 }).rotate();
  if (meta.width > maxEdge || frameHeight > maxEdge) {
    pipeline =
      meta.width >= frameHeight
        ? pipeline.resize({ width: maxEdge, withoutEnlargement: true })
        : pipeline.resize({ height: maxEdge, withoutEnlargement: true });
  }

  try {
    const buffer = await pipeline.webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
    if (!buffer.length) throw new ImageOptimizeError();
    return { buffer, mime: 'image/webp', ext: 'webp' };
  } catch (err) {
    if (err instanceof ImageOptimizeError) throw err;
    throw new ImageOptimizeError();
  }
}

export async function compressUploadedImage(buffer: Buffer, maxEdge: number): Promise<OptimizedImage> {
  try {
    return await optimizeUploadImage(buffer, { maxEdge });
  } catch (err) {
    if (err instanceof ImageOptimizeError) {
      throw new BadRequestException('Không đọc được ảnh. Hãy dùng JPEG, PNG, WebP hoặc GIF.');
    }
    throw err;
  }
}
