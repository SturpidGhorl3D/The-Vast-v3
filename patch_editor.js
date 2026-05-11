const fs = require('fs');
let content = fs.readFileSync('components/ui/species-editor/SpeciesEditor.tsx', 'utf8');

// 1. Remove labels
content = content.replace(/ctx\.fillText\('Якорь', part\.anchorX \+ 10, part\.anchorY - 10\);/g, '// REMOVED');
content = content.replace(/ctx\.fillText\('Связь', part\.attachX \+ 10, part\.attachY - 10\);/g, '// REMOVED');

// 2. Add SUB-MODE UI
const uiSearch = `                  {editorMode === 'JOINTS' && (
                    <div className="space-y-4">`;
const uiReplace = `                  {editorMode === 'JOINTS' && (
                    <div className="space-y-4">
                      <div className="flex gap-1 mb-2 p-1 bg-neutral-900 border border-neutral-700 rounded-lg">
                          <button 
                             onClick={() => setJointsSubMode('JOINT')} 
                             className={\`flex-1 py-1.5 px-2 rounded-md text-[9px] uppercase font-bold transition-all \${jointsSubMode === 'JOINT' ? 'bg-blue-600 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}\`}
                          >
                             Сустав
                          </button>
                          <button 
                             onClick={() => setJointsSubMode('ANCHOR')} 
                             className={\`flex-1 py-1.5 px-2 rounded-md text-[9px] uppercase font-bold transition-all \${jointsSubMode === 'ANCHOR' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}\`}
                          >
                             Якорь
                          </button>
                      </div>`;
content = content.replace(uiSearch, uiReplace);

// 3. Add Verlet UI
const physicsSearch = `<button onClick={() => updateSelectedPart({ physicsMode: 'VERLET' })} className={\`flex-1 text-xs py-1 rounded transition-colors \${selectedPart.physicsMode === 'VERLET' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}\`}>Verlet/Soft</button>
                        </div>
                     </div>`;
const physicsReplace = `<button onClick={() => updateSelectedPart({ physicsMode: 'VERLET' })} className={\`flex-1 text-xs py-1 rounded transition-colors \${selectedPart.physicsMode === 'VERLET' ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'}\`}>Verlet/Soft</button>
                        </div>
                        {selectedPart.physicsMode === 'VERLET' && (
                          <div className="space-y-4 pt-2 border-t border-neutral-800">
                             <label className="block">
                               <span className="text-[10px] text-neutral-500 mb-1 block uppercase font-bold">Сегменты: {selectedPart.verletSegments || 4}</span>
                               <input type="range" min="2" max="15" value={selectedPart.verletSegments || 4} onChange={e => updateSelectedPart({ verletSegments: parseInt(e.target.value) })} className="w-full h-1 accent-blue-500" />
                             </label>
                             <label className="block">
                               <span className="text-[10px] text-neutral-500 mb-1 block uppercase font-bold">Упругость: {selectedPart.verletStiffness || 0.8}</span>
                               <input type="range" min="0.1" max="1" step="0.1" value={selectedPart.verletStiffness || 0.8} onChange={e => updateSelectedPart({ verletStiffness: parseFloat(e.target.value) })} className="w-full h-1 accent-green-500" />
                             </label>
                          </div>
                        )}
                     </div>`;
content = content.replace(physicsSearch, physicsReplace);

fs.writeFileSync('components/ui/species-editor/SpeciesEditor.tsx', content);
console.log('Patch applied successfully');
