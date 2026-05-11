
import { Graphics2D } from '../babylon/Graphics2D';

export class BaseRenderer {
  public graphics: Graphics2D;

  constructor(graphics: Graphics2D) {
    this.graphics = graphics;
  }

  public parseColor(color: string): { color: number; alpha: number } {
    if (typeof (color as any) === 'number') return { color: color as any as number, alpha: 1 };
    if (!color) return { color: 0x050505, alpha: 1 };

    if (color.startsWith('#')) {
      const hex = color.slice(1);
      let colorNum = 0;
      if (hex.length === 3) {
        const r = hex[0] + hex[0];
        const g = hex[1] + hex[1];
        const b = hex[2] + hex[2];
        colorNum = parseInt(r + g + b, 16);
      } else {
        colorNum = parseInt(hex, 16);
      }
      return { color: colorNum, alpha: 1 };
    }

    if (color.startsWith('rgb')) {
      const matches = color.match(/[\d.]+/g);
      if (matches && matches.length >= 3) {
        const r = parseInt(matches[0], 10);
        const g = parseInt(matches[1], 10);
        const b = parseInt(matches[2], 10);
        const a = matches.length >= 4 ? parseFloat(matches[3]) : 1;
        return { color: (r << 16) | (g << 8) | b, alpha: a };
      }
    }

    return { color: 0x050505, alpha: 1 };
  }

  public colorToNumber(color: string): number {
    return this.parseColor(color).color;
  }

  public createStaticRNG(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    return () => {
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
}
