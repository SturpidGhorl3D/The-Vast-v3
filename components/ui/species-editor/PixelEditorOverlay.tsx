
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Pen, Eraser, Check } from 'lucide-react';
import { CreaturePartNode } from './types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function PixelEditorOverlay({ 
  initialDataUrl,
  partWidth,
  partHeight,
  nodes,
  defaultColor,
  onSave, 
  onClose 
}: { 
  initialDataUrl?: string,
  partWidth: number,
  partHeight: number,
  nodes: CreaturePartNode[],
  defaultColor: string,
  onSave: (dataUrl: string) => void, 
  onClose: () => void 
}) {
  const isMobile = useIsMobile();
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const [currentColor, setCurrentColor] = useState('#ffffff');
  const [tool, setTool] = useState<'PEN' | 'ERASER'>('PEN');
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });

  const texWidth = Math.max(1, Math.floor(partWidth / 2));
  const texHeight = Math.max(1, Math.floor(partHeight / 2));

  useEffect(() => {
    const ctx = pixelCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = false;
    
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, texWidth, texHeight);
        ctx.drawImage(img, 0, 0, texWidth, texHeight);
      };
      img.src = initialDataUrl;
    } else {
      ctx.clearRect(0, 0, texWidth, texHeight);
       const shapePath = new Path2D();
       for (let i = 0; i < nodes.length; i++) {
           const n = nodes[i];
           const nx = n.x * texWidth;
           const ny = n.y * texHeight;
           const nrad = n.radius / 2;
           shapePath.arc(nx, ny, nrad, 0, Math.PI * 2);
           
           if (i < nodes.length - 1) {
               const next = nodes[i+1];
               const nextx = next.x * texWidth;
               const nexty = next.y * texHeight;
               const nextrad = next.radius / 2;
               
               const angle = Math.atan2(nexty - ny, nextx - nx);
               const p1x = nx + Math.cos(angle + Math.PI/2) * nrad;
               const p1y = ny + Math.sin(angle + Math.PI/2) * nrad;
               const p2x = nx + Math.cos(angle - Math.PI/2) * nrad;
               const p2y = ny + Math.sin(angle - Math.PI/2) * nrad;
               
               const p3x = nextx + Math.cos(angle - Math.PI/2) * nextrad;
               const p3y = nexty + Math.sin(angle - Math.PI/2) * nextrad;
               const p4x = nextx + Math.cos(angle + Math.PI/2) * nextrad;
               const p4y = nexty + Math.sin(angle + Math.PI/2) * nextrad;
               
               shapePath.moveTo(p1x, p1y);
               shapePath.lineTo(p2x, p2y);
               shapePath.lineTo(p3x, p3y);
               shapePath.lineTo(p4x, p4y);
               shapePath.closePath();
           }
       }
       ctx.fillStyle = defaultColor;
       ctx.fill(shapePath);
    }
  }, [initialDataUrl, partWidth, partHeight, texWidth, texHeight, nodes, defaultColor]);

  const drawPixel = (e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent) => {
    const canvas = pixelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    if (tool === 'PEN') {
      ctx.fillStyle = currentColor;
      ctx.fillRect(x, y, 1, 1);
    } else {
      ctx.clearRect(x, y, 1, 1);
    }
  };

  const [pointers, setPointers] = useState<Record<number, { x: number, y: number }>>({});
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Add pointer to tracking
    const newPointers = { ...pointers, [e.pointerId]: { x: e.clientX, y: e.clientY } };
    setPointers(newPointers);

    const pointerCount = Object.keys(newPointers).length;
    
    if (pointerCount === 2) {
      const p1 = Object.values(newPointers)[0];
      const p2 = Object.values(newPointers)[1];
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      setInitialPinchDist(dist);
      return;
    }

    if (e.button === 1 || e.button === 2) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      setLastPan({ x: e.clientX, y: e.clientY });
      return;
    }
    if (e.button === 0 || e.pointerType === 'touch') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      drawPixel(e);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const newPointers = { ...pointers, [e.pointerId]: { x: e.clientX, y: e.clientY } };
    setPointers(newPointers);

    const pointerIds = Object.keys(newPointers);
    if (pointerIds.length === 2 && initialPinchDist !== null) {
      const p1 = newPointers[Number(pointerIds[0])];
      const p2 = newPointers[Number(pointerIds[1])];
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      
      const delta = dist / initialPinchDist;
      const zoomFactor = (delta - 1) * 0.05;
      setZoom(prev => Math.min(Math.max(0.2, prev + zoomFactor), 10));
      return;
    }

    if (isPanning) {
      setPan(prev => ({ x: prev.x + (e.clientX - lastPan.x), y: prev.y + (e.clientY - lastPan.y) }));
      setLastPan({ x: e.clientX, y: e.clientY });
      return;
    }
    if (isDrawing) drawPixel(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (isPanning) setIsPanning(false);
    if (isDrawing) setIsDrawing(false);

    const newPointers = { ...pointers };
    delete newPointers[e.pointerId];
    setPointers(newPointers);
    
    if (Object.keys(newPointers).length < 2) {
      setInitialPinchDist(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = -e.deltaY * 0.005;
    setZoom(prev => Math.min(Math.max(0.2, prev + zoomFactor), 10));
  };

  const save = () => {
    if (pixelCanvasRef.current) {
       onSave(pixelCanvasRef.current.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950 flex flex-col z-[100] animate-in fade-in zoom-in-95 duration-200">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-neutral-900 shrink-0">
          <div className="flex items-center gap-4">
             <h3 className="font-bold text-sm sm:text-base uppercase tracking-widest text-blue-400">Редактор текстуры</h3>
             <span className="text-[10px] sm:text-xs font-mono text-neutral-500 bg-black/50 px-2 py-0.5 rounded">{texWidth}x{texHeight} PX</span>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
            <X size={24}/>
          </button>
      </header>
      
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
         {/* Center: Canvas Area */}
         <div 
           className="flex-1 bg-black relative overflow-hidden flex items-center justify-center cursor-crosshair touch-none"
           onWheel={handleWheel}
           onContextMenu={e => e.preventDefault()}
           style={{ 
             backgroundImage: 'linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111)', 
             backgroundSize: '20px 20px', 
             backgroundPosition: '0 0, 10px 10px',
           }}
         >
           <canvas 
             ref={pixelCanvasRef}
             width={texWidth}
             height={texHeight}
             onPointerDown={handlePointerDown}
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
             className="outline-none border border-white/10 shadow-2xl"
             style={{ 
               cursor: isPanning ? 'grabbing' : tool === 'PEN' ? 'crosshair' : 'cell',
               imageRendering: 'pixelated',
               width: `${texWidth * 16 * zoom}px`,
               height: `${texHeight * 16 * zoom}px`,
               transform: `translate(${pan.x}px, ${pan.y}px)`,
               display: 'block'
             }}
           />

           {/* Canvas Controls Info */}
           <div className="absolute bottom-4 left-4 pointer-events-none hidden sm:block">
              <div className="text-[10px] text-neutral-500 font-mono space-y-1 bg-black/50 p-2 rounded border border-white/5">
                <div>SCROLL / PINCH: Масштаб</div>
                <div>RIGHT CLICK / 2-FINGERS: Смещение</div>
              </div>
           </div>
         </div>
         
         {/* Sidebar/Toolbar */}
         <aside className="w-full md:w-64 bg-neutral-900 border-t md:border-t-0 md:border-l border-white/10 p-4 flex flex-row md:flex-col gap-4 items-center md:items-stretch overflow-x-auto shrink-0">
           <div className="flex flex-row md:flex-col gap-2 shrink-0">
              <div className="text-[10px] text-neutral-500 font-mono uppercase mb-1 hidden md:block">Инструменты</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTool('PEN')} 
                  className={cn(
                    "flex-1 p-3 md:p-3 rounded-lg flex items-center justify-center gap-2 transition-all border",
                    tool === 'PEN' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-neutral-800 border-white/5 text-neutral-400 hover:bg-neutral-700'
                  )}
                >
                  <Pen size={18}/>
                  <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">Перо</span>
                </button>
                <button 
                  onClick={() => setTool('ERASER')} 
                  className={cn(
                    "flex-1 p-3 md:p-3 rounded-lg flex items-center justify-center gap-2 transition-all border",
                    tool === 'ERASER' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-neutral-800 border-white/5 text-neutral-400 hover:bg-neutral-700'
                  )}
                >
                  <Eraser size={18}/>
                  <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">Ластик</span>
                </button>
              </div>
           </div>
           
           <div className="flex-1 md:flex-none flex flex-row md:flex-col gap-2 shrink-0 md:border-t md:border-white/5 md:pt-4">
              <div className="text-[10px] text-neutral-500 font-mono uppercase mb-1 hidden md:block">Выбор цвета</div>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={currentColor} 
                  onChange={e => setCurrentColor(e.target.value)} 
                  className="w-10 h-10 md:w-full md:h-12 border-0 p-1 rounded-lg cursor-pointer bg-neutral-800 border border-white/10" 
                />
                <span className="hidden md:block font-mono text-xs text-neutral-400">{currentColor.toUpperCase()}</span>
              </div>
           </div>
           
           <div className="md:mt-auto shrink-0">
              <button 
                onClick={save} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 transition-all rounded-lg py-3 px-6 text-sm text-white font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Check className="hidden md:block" size={18}/>
                Применить
              </button>
           </div>
         </aside>
      </div>
    </div>
  );
}
