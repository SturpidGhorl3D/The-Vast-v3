
'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CreaturePart, CreaturePartNode } from './types';

interface PartEditorPanelProps {
  selectedPart: CreaturePart | undefined;
  editorMode: 'VIEW' | 'SHAPE' | 'JOINTS';
  jointsSubMode: 'ANCHOR' | 'JOINT';
  setJointsSubMode: (m: 'ANCHOR' | 'JOINT') => void;
  updateSelectedPart: (updates: Partial<CreaturePart>) => void;
  updateNode: (id: string, updates: Partial<CreaturePartNode>) => void;
  addNode: () => void;
  removeNode: (id: string) => void;
}

export function PartEditorPanel({
  selectedPart,
  editorMode,
  jointsSubMode,
  setJointsSubMode,
  updateSelectedPart,
  updateNode,
  addNode,
  removeNode
}: PartEditorPanelProps) {
  if (!selectedPart) {
    return (
      <div className="flex-1 bg-neutral-800 flex flex-col overflow-y-auto">
        <div className="p-4 text-neutral-500 text-sm italic text-center mt-10 uppercase font-mono tracking-widest opacity-50">Выберите часть</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-neutral-800 flex flex-col overflow-y-auto w-full">
      <div className="p-3 border-b border-white/10 font-bold uppercase text-[10px] text-neutral-400 tracking-wider">Свойства</div>
      <div className="p-4 space-y-6">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs text-neutral-400 mb-1 block">Название</span>
            <input 
              type="text" 
              value={selectedPart.name} 
              onChange={e => updateSelectedPart({ name: e.target.value })} 
              className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
            />
          </label>

          {editorMode === 'SHAPE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-neutral-400 mb-1 block">Ширина</span>
                  <input type="number" value={selectedPart.width} onChange={e => updateSelectedPart({ width: Number(e.target.value) })} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs text-neutral-400 mb-1 block">Высота</span>
                  <input type="number" value={selectedPart.height} onChange={e => updateSelectedPart({ height: Number(e.target.value) })} className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm outline-none" />
                </label>
              </div>
              <div className="p-3 bg-neutral-900 border border-neutral-700 rounded space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-neutral-400 uppercase font-bold">Узлы формы</span>
                  <button onClick={addNode} className="p-1 bg-neutral-800 hover:bg-neutral-700 rounded"><Plus size={14}/></button>
                </div>
                {selectedPart.nodes.map((n, i) => (
                  <div key={n.id} className="p-2 border border-neutral-700 bg-neutral-800 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-neutral-300">Узел {i + 1}</span>
                      <button onClick={() => removeNode(n.id)} className="text-red-400 hover:text-red-300"><Trash2 size={12}/></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <input type="number" step="0.01" value={n.x} onChange={e => updateNode(n.id, { x: Number(e.target.value) })} className="bg-black border border-neutral-700 rounded p-1 text-xs outline-none" />
                      <input type="number" step="0.01" value={n.y} onChange={e => updateNode(n.id, { y: Number(e.target.value) })} className="bg-black border border-neutral-700 rounded p-1 text-xs outline-none" />
                      <input type="number" value={n.radius} onChange={e => updateNode(n.id, { radius: Number(e.target.value) })} className="bg-black border border-neutral-700 rounded p-1 text-xs outline-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editorMode === 'JOINTS' && (
            <div className="space-y-4">
              <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-700 rounded-lg">
                <button onClick={() => setJointsSubMode('JOINT')} className={`flex-1 py-1 rounded text-[10px] uppercase font-bold ${jointsSubMode === 'JOINT' ? 'bg-blue-600 text-white' : 'text-neutral-500'}`}>СУСТАВ</button>
                <button onClick={() => setJointsSubMode('ANCHOR')} className={`flex-1 py-1 rounded text-[10px] uppercase font-bold ${jointsSubMode === 'ANCHOR' ? 'bg-red-600 text-white' : 'text-neutral-500'}`}>ЯКОРЬ</button>
              </div>
              <label className="block">
                <span className="text-xs text-neutral-400 mb-1 flex justify-between"><span>Вращение</span> <span className="text-blue-400">{selectedPart.rotation}°</span></span>
                <input type="range" min="-180" max="180" value={selectedPart.rotation} onChange={e => updateSelectedPart({ rotation: Number(e.target.value) })} className="w-full accent-blue-500" />
              </label>
              {/* Add more joint controls as needed */}
            </div>
          )}

          {editorMode === 'VIEW' && (
            <div className="space-y-4">
              <div className="p-3 bg-neutral-900 border border-neutral-700 rounded space-y-4">
                <span className="text-xs text-neutral-400 uppercase font-bold block mb-2">Анимация</span>
                
                <div className="flex bg-neutral-800 rounded p-1 shrink-0 overflow-x-auto no-scrollbar">
                  <button onClick={() => updateSelectedPart({ animType: 'NONE' })} className={`flex-1 min-w-[40px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.animType === 'NONE' || !selectedPart.animType ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Выкл</button>
                  <button onClick={() => updateSelectedPart({ animType: 'SKELETAL' })} className={`flex-1 min-w-[50px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.animType === 'SKELETAL' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Skeletal</button>
                  <button onClick={() => updateSelectedPart({ animType: 'IK' })} className={`flex-1 min-w-[30px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.animType === 'IK' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white'}`}>IK</button>
                  <button onClick={() => updateSelectedPart({ animType: 'DEFORMATION' })} className={`flex-1 min-w-[70px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.animType === 'DEFORMATION' ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Deform</button>
                </div>

                {selectedPart.animType !== 'NONE' && (
                  <div className="space-y-4 pt-2 border-t border-white/5">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Вторичная анимация (Mix)</span>
                    <div className="flex bg-neutral-800 rounded p-1 shrink-0 overflow-x-auto no-scrollbar">
                      <button onClick={() => updateSelectedPart({ secondaryAnimType: 'NONE' })} className={`flex-1 min-w-[40px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.secondaryAnimType === 'NONE' || !selectedPart.secondaryAnimType ? 'bg-neutral-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Нет</button>
                      <button onClick={() => updateSelectedPart({ secondaryAnimType: 'SKELETAL' })} className={`flex-1 min-w-[50px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.secondaryAnimType === 'SKELETAL' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Skeletal</button>
                      <button onClick={() => updateSelectedPart({ secondaryAnimType: 'IK' })} className={`flex-1 min-w-[30px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.secondaryAnimType === 'IK' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white'}`}>IK</button>
                      <button onClick={() => updateSelectedPart({ secondaryAnimType: 'DEFORMATION' })} className={`flex-1 min-w-[70px] text-[10px] py-1.5 rounded transition-colors ${selectedPart.secondaryAnimType === 'DEFORMATION' ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Deform</button>
                    </div>

                    {selectedPart.secondaryAnimType && selectedPart.secondaryAnimType !== 'NONE' && (
                      <label className="block">
                        <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Смешивание <span>{(selectedPart.animMixFactor || 0.5).toFixed(2)}</span></span>
                        <input type="range" min="0" max="1" step="0.01" value={selectedPart.animMixFactor || 0.5} onChange={e => updateSelectedPart({ animMixFactor: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                      </label>
                    )}
                  </div>
                )}

                {(selectedPart.animType === 'SKELETAL' || selectedPart.animType === 'DEFORMATION' || (selectedPart.secondaryAnimType && selectedPart.secondaryAnimType !== 'NONE')) && (
                  <div className="space-y-3 pt-2">
                    {selectedPart.animType === 'DEFORMATION' && (
                      <p className="text-[9px] text-purple-400 mb-2 italic">Режим деформации: пульсация узлов на основе параметров ниже</p>
                    )}
                    <label className="block">
                      <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Скорость <span>{(selectedPart.animSpeed || 0).toFixed(1)}</span></span>
                      <input type="range" min="0" max="10" step="0.1" value={selectedPart.animSpeed || 0} onChange={e => updateSelectedPart({ animSpeed: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Амплитуда <span>{(selectedPart.animAmplitude || 0).toFixed(1)}°</span></span>
                      <input type="range" min="0" max="45" step="1" value={selectedPart.animAmplitude || 0} onChange={e => updateSelectedPart({ animAmplitude: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Фаза <span>{(selectedPart.animPhase || 0).toFixed(1)}</span></span>
                      <input type="range" min="0" max="6.28" step="0.1" value={selectedPart.animPhase || 0} onChange={e => updateSelectedPart({ animPhase: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </label>
                  </div>
                )}

                {(selectedPart.animType === 'IK' || selectedPart.secondaryAnimType === 'IK') && (
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] text-neutral-500 italic">Переместите IK-мишень на холсте для настройки цели</p>
                    <label className="block">
                      <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Влияние IK <span>{(selectedPart.ikWeight ?? 1).toFixed(2)}</span></span>
                      <input type="range" min="0" max="1" step="0.01" value={selectedPart.ikWeight ?? 1} onChange={e => updateSelectedPart({ ikWeight: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                       <input type="number" value={selectedPart.ikTargetX || 0} onChange={e => updateSelectedPart({ ikTargetX: Number(e.target.value) })} className="bg-black/50 border border-neutral-700 rounded p-1 text-[10px]" placeholder="X" />
                       <input type="number" value={selectedPart.ikTargetY || 0} onChange={e => updateSelectedPart({ ikTargetY: Number(e.target.value) })} className="bg-black/50 border border-neutral-700 rounded p-1 text-[10px]" placeholder="Y" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 bg-neutral-900 border border-neutral-700 rounded space-y-3">
                <span className="text-xs text-neutral-400 uppercase font-bold block mb-2">Физика</span>
                <div className="flex bg-neutral-800 rounded p-1 mb-2">
                  <button onClick={() => updateSelectedPart({ physicsMode: 'RIGID' })} className={`flex-1 text-[10px] py-1.5 rounded transition-colors ${selectedPart.physicsMode === 'RIGID' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Rigid Body</button>
                  <button onClick={() => updateSelectedPart({ physicsMode: 'VERLET' })} className={`flex-1 text-[10px] py-1.5 rounded transition-colors ${selectedPart.physicsMode === 'VERLET' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}`}>Verlet/Soft</button>
                </div>

                {selectedPart.physicsMode === 'RIGID' && (
                   <label className="block p-2 bg-black/20 rounded border border-white/5">
                      <span className="text-[10px] text-neutral-500 mb-2 flex justify-between uppercase">Адаптация Verlet <span>{(selectedPart.verletAdaptationWeight ?? 0).toFixed(2)}</span></span>
                      <input type="range" min="0" max="1" step="0.01" value={selectedPart.verletAdaptationWeight ?? 0} onChange={e => updateSelectedPart({ verletAdaptationWeight: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                      <p className="text-[9px] text-neutral-600 mt-1 italic">Позволяет жесткой конечности следовать физике верле</p>
                   </label>
                )}

                {selectedPart.physicsMode === 'VERLET' && (
                  <div className="space-y-4 pt-2 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-2">
                       <label className="block">
                         <span className="text-[10px] text-neutral-500 mb-1 uppercase">Сегменты</span>
                         <input type="number" min="1" max="20" value={selectedPart.verletSegments || 6} onChange={e => updateSelectedPart({ verletSegments: Number(e.target.value) })} className="w-full bg-black/50 border border-neutral-700 rounded p-1 text-[10px]" />
                       </label>
                       <label className="block">
                         <span className="text-[10px] text-neutral-500 mb-1 uppercase">Жесткость</span>
                         <input type="number" step="0.1" min="0" max="1" value={selectedPart.verletStiffness || 0.8} onChange={e => updateSelectedPart({ verletStiffness: Number(e.target.value) })} className="w-full bg-black/50 border border-neutral-700 rounded p-1 text-[10px]" />
                       </label>
                    </div>

                    <label className="block">
                      <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Затухание <span>{selectedPart.verletDamping ?? 0.9}</span></span>
                      <input type="range" min="0.5" max="0.99" step="0.01" value={selectedPart.verletDamping ?? 0.9} onChange={e => updateSelectedPart({ verletDamping: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </label>

                    <div className="flex items-center justify-between p-2 bg-black/20 rounded border border-white/5">
                       <span className="text-[10px] text-neutral-400 uppercase">Гравитация</span>
                       <div className="flex items-center gap-2">
                          <input type="checkbox" checked={selectedPart.verletGravityEnabled !== false} onChange={e => updateSelectedPart({ verletGravityEnabled: e.target.checked })} className="accent-blue-500" />
                          <input type="number" step="0.1" className="w-12 bg-neutral-800 border border-neutral-700 rounded p-0.5 text-[10px]" value={selectedPart.verletGravity ?? 0.5} onChange={e => updateSelectedPart({ verletGravity: Number(e.target.value) })} />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       <div className="flex items-center justify-between p-2 bg-black/20 rounded border border-white/5">
                          <span className="text-[10px] text-neutral-400 uppercase">Verlet IK</span>
                          <input type="checkbox" checked={!!selectedPart.verletIKEnabled} onChange={e => updateSelectedPart({ verletIKEnabled: e.target.checked })} className="accent-emerald-500" />
                       </div>
                       <label className="block p-2 bg-black/20 rounded border border-white/5">
                          <span className="text-[10px] text-neutral-400 mb-1 block uppercase">Лимит сустава</span>
                          <input type="number" min="0" max="180" value={selectedPart.verletJointLimit ?? 30} onChange={e => updateSelectedPart({ verletJointLimit: Number(e.target.value) })} className="w-full bg-neutral-800 border border-neutral-700 rounded p-0.5 text-[10px]" />
                       </label>
                    </div>

                    <div className="space-y-3 p-3 bg-black/30 rounded border border-white/5">
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] text-neutral-400 uppercase font-bold text-blue-400">Шевеление (Wiggle)</span>
                         <input type="checkbox" checked={!!selectedPart.verletWiggleEnabled} onChange={e => updateSelectedPart({ verletWiggleEnabled: e.target.checked })} className="accent-blue-500" />
                       </div>
                       
                       {selectedPart.verletWiggleEnabled && (
                         <div className="space-y-3 pt-2">
                           <div className="flex bg-neutral-800 rounded p-0.5">
                              {(['SWAY', 'WRIGGLE', 'TWITCH'] as const).map(type => (
                                <button key={type} onClick={() => updateSelectedPart({ verletWiggleType: type })} className={`flex-1 text-[9px] py-1 rounded ${selectedPart.verletWiggleType === type ? 'bg-neutral-600 text-white' : 'text-neutral-500 hover:text-white'}`}>{type}</button>
                              ))}
                           </div>
                           <label className="block">
                             <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Пульс <span>{(selectedPart.verletWigglePulse ?? 2).toFixed(1)}</span></span>
                             <input type="range" min="0.1" max="10" step="0.1" value={selectedPart.verletWigglePulse ?? 2} onChange={e => updateSelectedPart({ verletWigglePulse: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                           </label>
                           <label className="block">
                             <span className="text-[10px] text-neutral-500 mb-1 flex justify-between uppercase">Амплитуда <span>{(selectedPart.verletWiggleAmplitude ?? 50).toFixed(0)}</span></span>
                             <input type="range" min="0" max="200" step="1" value={selectedPart.verletWiggleAmplitude ?? 50} onChange={e => updateSelectedPart({ verletWiggleAmplitude: Number(e.target.value) })} className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                           </label>
                         </div>
                       )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
