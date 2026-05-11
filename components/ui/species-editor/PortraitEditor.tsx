
'use client';

import React, { useState, useRef } from 'react';
import { ArrowLeft, Save, UserPlus, Settings2, Eye, Layout, X } from 'lucide-react';
import { CreaturePart, CreaturePartNode } from './types';
import { DEFAULT_TORSO, HUMAN_PREFABS } from './PortraitPresets';
import { PixelEditorOverlay } from './PixelEditorOverlay';
import { PortraitCanvas } from './PortraitCanvas';
import { AnatomyTree } from './AnatomyTree';
import { PartEditorPanel } from './PartEditorPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function PortraitEditor({ 
  onExit, 
  onSavePortrait, 
  initialParts 
}: { 
  onExit: () => void, 
  onSavePortrait?: (dataUrl: string, parts: any[]) => void, 
  initialParts?: any[] 
}) {
  const isMobile = useIsMobile();
  const [parts, setParts] = useState<CreaturePart[]>(initialParts || [DEFAULT_TORSO]);
  const [selectedPartId, setSelectedPartId] = useState<string>('root-torso');
  const [isPixelEditMode, setIsPixelEditMode] = useState(false);
  const [editorMode, setEditorMode] = useState<'VIEW' | 'SHAPE' | 'JOINTS'>('VIEW');
  const [jointsSubMode, setJointsSubMode] = useState<'ANCHOR' | 'JOINT'>('JOINT');
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [draggedPartId, setDraggedPartId] = useState<string | null>(null);
  
  // Mobile UI state
  const [activeMobilePanel, setActiveMobilePanel] = useState<'CANVAS' | 'ANATOMY' | 'PROPERTIES'>('CANVAS');

  const selectedPart = parts.find(p => p.id === selectedPartId);

  const updateSelectedPart = (updates: Partial<CreaturePart>) => {
    setParts(parts.map(p => p.id === selectedPartId ? { ...p, ...updates } : p));
  };

  const updateNode = (nodeId: string, updates: Partial<CreaturePartNode>) => {
    if (!selectedPart) return;
    const newNodes = selectedPart.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n);
    updateSelectedPart({ nodes: newNodes });
  };

  const addNode = () => {
    if (!selectedPart) return;
    const lastNode = selectedPart.nodes[selectedPart.nodes.length - 1];
    const newNodes = [...selectedPart.nodes, { 
       id: crypto.randomUUID(), 
       x: lastNode ? lastNode.x : 0.5, 
       y: lastNode ? Math.min(1, lastNode.y + 0.1) : 0.5, 
       radius: lastNode ? lastNode.radius : 10 
    }];
    updateSelectedPart({ nodes: newNodes });
  };

  const removeNode = (nodeId: string) => {
    if (!selectedPart || selectedPart.nodes.length <= 1) return;
    updateSelectedPart({ nodes: selectedPart.nodes.filter(n => n.id !== nodeId) });
  };

  const removeSelectedPart = () => {
    if (selectedPartId === 'root-torso') return;
    setParts(parts.filter(p => p.id !== selectedPartId));
    setSelectedPartId('root-torso');
  };

  const duplicateAndMirror = (partId: string) => {
    const partToCopy = parts.find(p => p.id === partId);
    if (!partToCopy) return;

    const torso = parts.find(p => p.type === 'TORSO') || parts[0];
    const torsoZ = torso.zIndex;

    const copyRecursive = (pId: string, newParentId: string | null, isRoot: boolean): CreaturePart[] => {
      const original = parts.find(p => p.id === pId);
      if (!original) return [];

      const newId = crypto.randomUUID();
      const newPart: CreaturePart = JSON.parse(JSON.stringify(original));
      newPart.id = newId;
      newPart.parentId = newParentId;

      if (isRoot) {
        newPart.name = `${original.name} (Mirror)`;
        if (original.parentId) {
          const parent = parts.find(px => px.id === original.parentId);
          if (parent) {
             newPart.attachX = parent.anchorX - (original.attachX - parent.anchorX);
          }
        }
        newPart.rotation = -original.rotation;
        if (original.minRotation !== undefined) newPart.maxRotation = -original.minRotation;
        if (original.maxRotation !== undefined) newPart.minRotation = -original.maxRotation;
        newPart.zIndex = torsoZ - (original.zIndex - torsoZ);
      } else {
        newPart.zIndex = torsoZ - (original.zIndex - torsoZ);
      }

      let result = [newPart];
      const children = parts.filter(child => child.parentId === pId);
      children.forEach(child => {
        result = [...result, ...copyRecursive(child.id, newId, false)];
      });
      return result;
    };

    const newSubtree = copyRecursive(partId, partToCopy.parentId, true);
    setParts([...parts, ...newSubtree]);
  };

  const handleReparent = (childId: string, newParentId: string) => {
    if (childId === newParentId) return;
    setParts(parts.map(p => p.id === childId ? { ...p, parentId: newParentId } : p));
  };

  const addPart = (type: CreaturePart['type']) => {
    const newPart: CreaturePart = {
      id: crypto.randomUUID(),
      type,
      name: `Новая часть (${type})`,
      parentId: selectedPartId || 'root-torso',
      width: 64,
      height: 120,
      nodes: [
        { id: crypto.randomUUID(), x: 0.5, y: 0.2, radius: 12 },
        { id: crypto.randomUUID(), x: 0.5, y: 0.8, radius: 12 },
      ],
      color: '#0a0a0a',
      attachX: 40,
      attachY: type === 'HEAD' ? -10 : 70,
      rotation: 0,
      zIndex: 15,
      anchorX: 32,
      anchorY: 16,
      animSpeed: 2,
      animAmplitude: 2,
      animPhase: Math.random() * Math.PI,
      animType: 'SKELETAL',
      physicsMode: 'RIGID',
      customTexture: null,
    };
    setParts([...parts, newPart]);
    setSelectedPartId(newPart.id);
  };

  const addHumanPreset = () => {
    const torsoId = crypto.randomUUID();
    const torso: CreaturePart = { ...DEFAULT_TORSO, id: torsoId, ...(HUMAN_PREFABS.TORSO || {}) } as CreaturePart;
    setParts([torso]);
    setSelectedPartId(torsoId);
  };

  const handleSave = () => {
    if (onSavePortrait) {
        onSavePortrait('', parts); // dataUrl can be generated if needed
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-neutral-900 text-white flex flex-col font-sans">
      <header className="h-14 bg-neutral-950 border-b border-white/10 flex items-center justify-between px-3 sm:px-4 shrink-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft size={20} /></button>
          <h1 className="font-bold text-sm sm:text-lg tracking-wide uppercase truncate max-w-[120px] sm:max-w-none">Редактор портрета</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
           <button onClick={addHumanPreset} className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] sm:text-sm text-neutral-300 transition-colors">
              <UserPlus size={16} /> <span className="hidden xs:inline">Пресет</span>
           </button>
           <button onClick={handleSave} className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-[10px] sm:text-sm font-medium transition-colors">
              <Save size={16} /> <span className="hidden xs:inline">Сохранить</span>
           </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Anatomy Panel */}
        <aside className={cn(
          "bg-neutral-800 border-r border-white/10 flex flex-col transition-all duration-300 z-40",
          isMobile ? (activeMobilePanel === 'ANATOMY' ? "absolute inset-y-0 left-0 w-64 shadow-2xl" : "hidden") : "w-64"
        )}>
          <div className="p-3 border-b border-white/10 font-bold uppercase text-[10px] text-neutral-400 tracking-wider flex justify-between items-center">
            <span>Анатомия</span>
            {isMobile && <button onClick={() => setActiveMobilePanel('CANVAS')} className="text-white/40"><ArrowLeft size={16} /></button>}
          </div>
          <AnatomyTree 
            parts={parts} 
            selectedPartId={selectedPartId} 
            setSelectedPartId={setSelectedPartId}
            removeSelectedPart={removeSelectedPart}
            duplicateAndMirror={duplicateAndMirror}
            handleReparent={handleReparent}
            setDraggedPartId={setDraggedPartId}
            draggedPartId={draggedPartId}
          />
          <div className="p-2 border-t border-white/10 bg-neutral-800 space-y-2">
             <div className="grid grid-cols-2 gap-2">
                <button onClick={() => addPart('LIMB')} className="bg-neutral-700 hover:bg-neutral-600 p-2 text-[10px] rounded text-center">Конечность</button>
                <button onClick={() => addPart('HEAD')} className="bg-neutral-700 hover:bg-neutral-600 p-2 text-[10px] rounded text-center">Голова</button>
             </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className={cn(
          "flex-1 relative bg-neutral-900 flex flex-col transition-all",
          isMobile && activeMobilePanel !== 'CANVAS' && "opacity-20 pointer-events-none"
        )}>
          <PortraitCanvas 
            parts={parts} 
            selectedPartId={selectedPartId} 
            editorMode={editorMode} 
            jointsSubMode={jointsSubMode}
            camera={camera}
            onCameraChange={setCamera}
            onUpdatePart={(id, updates) => {
              setParts(parts.map(p => p.id === id ? { ...p, ...updates } : p));
            }}
          />
          
          <div className="h-12 bg-neutral-950 flex justify-center items-center gap-2 sm:gap-4 shrink-0 border-t border-neutral-800">
             <button onClick={() => setEditorMode('VIEW')} className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs rounded ${editorMode === 'VIEW' ? 'bg-neutral-700' : 'bg-neutral-800'}`}>ОСМОТР</button>
             <button onClick={() => setEditorMode('SHAPE')} className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs rounded ${editorMode === 'SHAPE' ? 'bg-blue-600' : 'bg-neutral-800'}`}>ФОРМА</button>
             <button onClick={() => setEditorMode('JOINTS')} className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs rounded ${editorMode === 'JOINTS' ? 'bg-green-600' : 'bg-neutral-800'}`}>СУСТАВЫ</button>
             <button onClick={() => setIsPixelEditMode(true)} className="px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs rounded bg-neutral-800">ТЕКСТУРА</button>
          </div>

          {/* Mobile Bottom Navigation */}
          {isMobile && (
            <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
               <button 
                onClick={() => setActiveMobilePanel('ANATOMY')}
                className={cn("p-3 rounded-full shadow-lg transition-all", activeMobilePanel === 'ANATOMY' ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400")}
               >
                 <Layout size={20} />
               </button>
               <button 
                onClick={() => setActiveMobilePanel('PROPERTIES')}
                className={cn("p-3 rounded-full shadow-lg transition-all", activeMobilePanel === 'PROPERTIES' ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-400")}
               >
                 <Settings2 size={20} />
               </button>
            </div>
          )}

          {isPixelEditMode && selectedPart && (
            <PixelEditorOverlay
              initialDataUrl={selectedPart.customTexture || undefined}
              partWidth={selectedPart.width}
              partHeight={selectedPart.height}
              nodes={selectedPart.nodes}
              defaultColor={selectedPart.color}
              onClose={() => setIsPixelEditMode(false)}
              onSave={(dataUrl) => {
                updateSelectedPart({ customTexture: dataUrl });
                setIsPixelEditMode(false);
              }}
            />
          )}
        </main>

        {/* Properties Panel */}
        <aside className={cn(
          "bg-neutral-800 transition-all duration-300 z-40",
          isMobile ? (activeMobilePanel === 'PROPERTIES' ? "absolute inset-y-0 right-0 w-80 shadow-2xl" : "hidden") : "w-80"
        )}>
           <div className={cn("h-full flex flex-col", isMobile && "relative")}>
             {isMobile && (
               <button 
                 onClick={() => setActiveMobilePanel('CANVAS')} 
                 className="absolute top-2 left-2 z-50 p-2 bg-neutral-900 rounded-full text-white/50"
               >
                 <X size={16} />
               </button>
             )}
              <PartEditorPanel 
                selectedPart={selectedPart}
                editorMode={editorMode}
                jointsSubMode={jointsSubMode}
                setJointsSubMode={setJointsSubMode}
                updateSelectedPart={updateSelectedPart}
                updateNode={updateNode}
                addNode={addNode}
                removeNode={removeNode}
              />
           </div>
        </aside>
      </div>
    </div>
  );
}
