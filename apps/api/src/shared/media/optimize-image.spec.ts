import sharp from 'sharp';
import { ImageOptimizeError, optimizeUploadImage } from './optimize-image';

describe('optimizeUploadImage', () => {
  it('converts a large PNG to WebP and caps the long edge', async () => {
    const png = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: { r: 30, g: 90, b: 180 },
      },
    })
      .png()
      .toBuffer();

    const out = await optimizeUploadImage(png, { maxEdge: 2048 });
    expect(out.ext).toBe('webp');
    expect(out.mime).toBe('image/webp');
    expect(out.buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');

    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(2048);
    expect(meta.height).toBeLessThanOrEqual(2048);
    expect(meta.width).toBe(2048);
  });

  it('rejects a buffer that is not an image', async () => {
    await expect(optimizeUploadImage(Buffer.from('not-an-image'), { maxEdge: 512 })).rejects.toBeInstanceOf(
      ImageOptimizeError,
    );
  });
});
