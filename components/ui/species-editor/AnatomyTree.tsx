
'use client';

import React from 'react';
import { Layers, Trash2 } from 'lucide-react';
import { CreaturePart } from './types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface AnatomyTreeProps {
  parts: CreaturePart[];
  selectedPartId: string;
  setSelectedPartId: (id: string) => void;
  removeSelectedPart: () => void;
  duplicateAndMirror: (id: string) => void;
  handleReparent: (childId: string, newParentId: string) => void;
  setDraggedPartId: (id: string | null) => void;
  draggedPartId: string | null;
}

export function AnatomyTree({
  parts,
  selectedPartId,
  setSelectedPartId,
  removeSelectedPart,
  duplicateAndMirror,
  handleReparent,
  setDraggedPartId,
  draggedPartId
}: AnatomyTreeProps) {
  const isMobile = useIsMobile();
  const renderTree = (part: CreaturePart, depth: number) => {
    const children = parts.filter(p => p.parentId === part.id);
    const isSelected = selectedPartId === part.id;
    return (
      <React.Fragment key={part.id}>
        <div
          draggable={!isMobile}
          onDragStart={() => setDraggedPartId(part.id)}
          onDragOver={(e) => {
            if (isMobile) return;
            e.preventDefault();
            if (draggedPartId && draggedPartId !== part.id) {
              e.currentTarget.classList.add('bg-blue-500/20');
            }
          }}
          onDragLeave={(e) => {
            if (isMobile) return;
            e.currentTarget.classList.remove('bg-blue-500/20');
          }}
          onDrop={(e) => {
            if (isMobile) return;
            e.preventDefault();
            e.currentTarget.classList.remove('bg-blue-500/20');
            if (draggedPartId) handleReparent(draggedPartId, part.id);
          }}
          onClick={() => setSelectedPartId(part.id)}
          style={{ paddingLeft: `${depth * 1 + 0.75}rem` }}
          className={`w-full text-left pr-3 py-2 text-sm rounded transition-all flex items-center justify-between group cursor-pointer outline-none ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/5 text-neutral-300'}`}
        >
          <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
            {depth > 0 && <div className="w-2 h-px bg-neutral-600 rounded-full shrink-0" />}
            <span className="truncate">{part.name}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1 transition-opacity", 
            !isMobile && "opacity-0 group-hover:opacity-100", 
            isMobile && isSelected && "opacity-100"
          )}>
            {isSelected && (
              <button 
                onClick={(e) => { e.stopPropagation(); duplicateAndMirror(part.id); }}
                className="p-1.5 hover:bg-white/20 rounded text-blue-200"
              >
                <Layers size={14} />
              </button>
            )}
            {part.type !== 'TORSO' && isSelected && (
              <button 
                onClick={(e) => { e.stopPropagation(); removeSelectedPart(); }}
                className="p-1.5 hover:bg-red-500/40 rounded text-red-300"
              >
                <Trash2 size={14}/>
              </button>
            )}
          </div>
        </div>
        {children.map(c => renderTree(c, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {parts.filter(p => p.parentId === null).map(rootPart => renderTree(rootPart, 0))}
    </div>
  );
}
