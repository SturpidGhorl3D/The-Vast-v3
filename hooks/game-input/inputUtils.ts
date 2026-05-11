
import { Point } from '@/components/game/types';

export function rectPoints(cx: number, cy: number, w: number, h: number) {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

export function closestVertexIndex(pts: { x: number; y: number }[], tx: number, ty: number): number {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - tx) ** 2 + (pts[i].y - ty) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

export function mirrorByPairAxis(x: number, y: number, pairAxis: 'X' | 'Y'): { x: number; y: number } {
  return pairAxis === 'X' ? { x: -x, y } : { x, y: -y };
}
