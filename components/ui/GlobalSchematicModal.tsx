'use client';

import React, { useEffect, useRef } from 'react';
import type { StarSystem } from '@/game/world/generator';
import { Camera } from '@/game/engine/camera';
import { Renderer } from '@/game/engine/renderer';

interface GlobalSchematicModalProps {
  system: StarSystem;
  onClose: () => void;
  onWarpTo: (x: number, y: number, label: string) => void;
  isMobile: boolean;
}

const PLANET_TYPE_LABELS: Record<string, string> = {
  ROCKY: 'Rocky', GAS_GIANT: 'Gas Giant', ICE: 'Ice World',
  VOLCANIC: 'Volcanic', OCEAN: 'Ocean', DESERT: 'Desert',
};

export default function GlobalSchematicModal({ system, onClose, onWarpTo, isMobile }: GlobalSchematicModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d')!;
    const W    = canvas.width;
    const H    = canvas.height;
    const cx   = W / 2;
    const cy   = H / 2;

    // Find outermost orbit to scale
    const maxOrbit = Math.max(
      ...system.planets.map(p => p.orbitRadius),
      ...(system.asteroidClusters.flatMap(c => c.ringOuterRadius ? [c.ringOuterRadius] : [c.radius])),
      system.starRadius * 4,
    );
    const scale = (Math.min(W, H) * 0.44) / maxOrbit;

    let startTime = performance.now();

    const draw = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, W, H);

      // Star
      const starR = Math.max(4, system.starRadius * scale);
      const starGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, starR * 3);
      starGrad.addColorStop(0, system.starColor + 'ff');
      starGrad.addColorStop(0.4, system.starColor + '66');
      starGrad.addColorStop(1, system.starColor + '00');
      ctx.beginPath();
      ctx.arc(cx, cy, starR * 3, 0, Math.PI * 2);
      ctx.fillStyle = starGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, starR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Asteroid rings
      system.asteroidClusters.forEach(cl => {
        if (cl.ringInnerRadius && cl.ringOuterRadius) {
          const ir = cl.ringInnerRadius * scale;
          const or = cl.ringOuterRadius * scale;
          ctx.globalAlpha = 0.15;
          ctx.fillStyle   = '#aaaaaa';
          ctx.beginPath();
          ctx.arc(cx, cy, or, 0, Math.PI * 2);
          ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
          ctx.fill('evenodd');
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#888';
          ctx.lineWidth   = 1;
          ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.arc(cx, cy, or, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      });

      // Planet orbits + planets
      system.planets.forEach((p, i) => {
        const orR = p.orbitRadius * scale;
        ctx.globalAlpha  = 0.2;
        ctx.strokeStyle  = '#ffffff';
        ctx.lineWidth    = 0.5;
        ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.arc(cx, cy, orR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        const angle = elapsed * p.orbitSpeed * 10 + i;
        const px    = cx + Math.cos(angle) * orR;
        const py    = cy + Math.sin(angle) * orR;
        const pr    = Math.max(2, p.radius * scale);

        const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr * 2);
        pGrad.addColorStop(0, p.color + 'aa');
        pGrad.addColorStop(1, p.color + '00');
        ctx.beginPath(); ctx.arc(px, py, pr * 2, 0, Math.PI * 2);
        ctx.fillStyle = pGrad; ctx.fill();

        ctx.beginPath(); ctx.arc(px, py, Math.max(2, pr), 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font      = `${isMobile ? 8 : 9}px monospace`;
        ctx.fillText(PLANET_TYPE_LABELS[p.type] ?? p.type, px + pr + 3, py + 3);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [system, isMobile]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const cx   = canvas.width / 2;
    const cy   = canvas.height / 2;
    const maxOrbit = Math.max(
      ...system.planets.map(p => p.orbitRadius),
      ...(system.asteroidClusters.flatMap(c => c.ringOuterRadius ? [c.ringOuterRadius] : [c.radius])),
      system.starRadius * 4,
    );
    const scale = (Math.min(canvas.width, canvas.height) * 0.44) / maxOrbit;
    const now   = performance.now() * 0.001;

    // Check planet click
    for (let i = 0; i < system.planets.length; i++) {
      const p     = system.planets[i];
      const angle = now * p.orbitSpeed * 10 + i;
      const px    = cx + Math.cos(angle) * p.orbitRadius * scale;
      const py    = cy + Math.sin(angle) * p.orbitRadius * scale;
      if (Math.hypot(mx - px, my - py) < 12) {
        const worldAngle = now * p.orbitSpeed * 10 + i;
        const wx = system.offsetX + Math.cos(worldAngle) * p.orbitRadius;
        const wy = system.offsetY + Math.sin(worldAngle) * p.orbitRadius;
        onWarpTo(wx, wy, `${PLANET_TYPE_LABELS[p.type] ?? 'Planet'} orbit`);
        return;
      }
    }

    // Click near center → warp to a safe position near the star (outside the corona)
    if (Math.hypot(mx - cx, my - cy) < 20) {
      const safeOrbit = (system.planets && system.planets.length > 0)
        ? system.planets[0].orbitRadius * 0.5
        : system.starRadius * 8;
      onWarpTo(system.offsetX + safeOrbit, system.offsetY, system.name);
    }
  };

  const W = isMobile ? Math.min(320, window.innerWidth - 24) : 460;
  const H = isMobile ? W : 360;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50 font-mono pointer-events-auto">
      <div className="bg-[#060a12] border border-white/20 rounded-lg overflow-hidden shadow-2xl"
           style={{ width: W, maxWidth: '95vw' }}>
        <div className="flex justify-between items-center px-4 py-2 border-b border-white/10">
          <div>
            <div className="text-blue-400 font-bold text-sm uppercase tracking-wide">{system.name}</div>
            <div className="text-white/30 text-[9px]">
              {system.planets.length} planet{system.planets.length !== 1 ? 's' : ''} · {system.asteroidClusters.length} ring{system.asteroidClusters.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="text-white/40 hover:text-white text-xs px-2 py-1" onClick={onClose}>✕ close</button>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block cursor-crosshair"
          onClick={handleCanvasClick}
        />

        <div className="px-4 py-2 border-t border-white/10 text-[9px] text-white/40">
          Click a planet or the star to set warp destination · then press SPACE / WARP
        </div>
      </div>
    </div>
  );
}
