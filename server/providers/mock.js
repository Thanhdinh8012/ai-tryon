// Offline provider for development & tests: no API key, no cost.
// It tints the person photo and pastes the garment in the corner so you can
// verify the whole pipeline (drop -> upload -> loop -> overlay).
import sharp from 'sharp';

export function createMockProvider({ delayMs = 700 } = {}) {
  return {
    name: 'mock',
    async generate({ person, garment }) {
      await new Promise((r) => setTimeout(r, delayMs));
      const base = sharp(person);
      const { width, height } = await base.metadata();
      const thumb = await sharp(garment)
        .resize(Math.round(width * 0.35), Math.round(height * 0.5), { fit: 'inside' })
        .png()
        .toBuffer();
      const buffer = await base
        .modulate({ saturation: 1.4, hue: 40 })
        .composite([{ input: thumb, gravity: 'southeast' }])
        .jpeg({ quality: 85 })
        .toBuffer();
      return { buffer, mime: 'image/jpeg' };
    },
  };
}
