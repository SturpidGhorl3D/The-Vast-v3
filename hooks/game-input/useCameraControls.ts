
'use client';

import { useEffect, MutableRefObject, RefObject } from 'react';
import { ViewMode } from '@/components/game/types';
import { clampCameraZoom } from '@/game/hullGeometry';

interface CameraControlsProps {
  engine: any;
  viewModeRef: MutableRefObject<ViewMode>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export const useCameraControls = ({
  engine,
  viewModeRef,
  canvasRef,
}: CameraControlsProps) => {
  useEffect(() => {
    if (!engine || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const camera = engine.camera;
      const player = engine.player;
      const hull = player !== null ? engine.ecs.getHull(player) : null;
      const wheel = Math.abs(e.deltaY);
      
      let baseStep = 0.003;
      if (viewModeRef.current === 'STRATEGIC') baseStep = 0.012;
      else if (viewModeRef.current === 'TACTICAL') baseStep = 0.008;
      
      const step = wheel * baseStep;
      const factor = e.deltaY > 0 ? Math.exp(-step) : Math.exp(step);
      camera.targetZoom *= factor;
      
      const r = engine.renderer;
      if (r) {
        if (engine.isEditorOpen) {
          clampCameraZoom(camera, r.width, r.height, 'editor', engine.draftHull);
        } else {
          const zm = viewModeRef.current === 'STRATEGIC' ? 'global' : viewModeRef.current === 'TACTICAL' ? 'tactical' : 'local';
          clampCameraZoom(camera, r.width, r.height, zm, hull);
        }
      }
    };

    let lastPinchDist = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const touchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        const dx = touchX - lastTouchX;
        const dy = touchY - lastTouchY;

        const camera = engine.camera;
        const r = engine.renderer;

        // Pan logic for TACTICAL and STRATEGIC modes
        if (r && (viewModeRef.current === 'TACTICAL' || viewModeRef.current === 'STRATEGIC')) {
          const zoom = camera.zoom;
          const worldDX = dx / zoom;
          const worldDY = dy / zoom;

          // Update mapPos in engine (camera follows it in these modes)
          if (engine.mapPos) {
            // We use a simplified offset update since mapPos is usually used for centering
            // For full precision we'd need to handle sector boundaries, but for small drags this is fine
            // as Engine usually normalizes these coordinates. 
            // If engine doesn't normalize, we should do it here or call an engine method.
            engine.mapPos.offsetX -= worldDX;
            engine.mapPos.offsetY -= worldDY;
            
            // Trigger emergency normalization if engine has it, otherwise camera might glitch at boundaries
            if (typeof engine.normalizeCoords === 'function') {
              engine.normalizeCoords(engine.mapPos);
            }
          }
        }

        // Zoom logic
        const pDX = e.touches[0].clientX - e.touches[1].clientX;
        const pDY = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(pDX * pDX + pDY * pDY);
        
        if (lastPinchDist > 0) {
          const factor = dist / lastPinchDist;
          if (r) {
            const player = engine.player;
            const hull = player !== null ? engine.ecs.getHull(player) : null;
            camera.targetZoom *= factor;
            if (engine.isEditorOpen) {
              clampCameraZoom(camera, r.width, r.height, 'editor', engine.draftHull);
            } else {
              const tzm = viewModeRef.current === 'STRATEGIC' ? 'global' : viewModeRef.current === 'TACTICAL' ? 'tactical' : 'local';
              clampCameraZoom(camera, r.width, r.height, tzm, hull);
            }
          }
        }
        
        lastPinchDist = dist;
        lastTouchX = touchX;
        lastTouchY = touchY;
      }
    };

    const handleTouchEnd = () => {
      lastPinchDist = 0;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [engine, viewModeRef, canvasRef]);
};
