
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Settings, LogOut, Plus, Trash2, Globe, ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { useMultiplayer } from '@/hooks/useMultiplayer';

import { GAME_VERSION } from '@/game/constants';
import { ORIGINS, OrganizationType } from '@/components/game/orgTypes';
import SpeciesDesigner from '@/components/ui/species-editor/SpeciesDesigner';
import type { SpeciesDefinition } from '@/components/game/speciesTypes';
import { AudioSettingsOverlay } from '../AudioSettingsOverlay';

// --- Types ---
export type AppState = 'MAIN_MENU' | 'WORLD_SELECT' | 'WORLD_CREATION' | 'MULTIPLAYER_LOBBY' | 'SETTINGS' | 'IN_GAME' | 'CREATIVE_EDITOR' | 'SPECIES_EDITOR';

export interface GameSave {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  difficulty: 'EASY' | 'NORMAL' | 'HARD';
  seed: string;
  clusterRadius: number;
  density: number;
  orgType: string;
  originId: string;
  species?: SpeciesDefinition; // Store species setup with the world
  researchedTechs?: string[];
  innovationPoints?: number;
}

// --- Main Menu ---
export function MainMenu({ onNavigate, onExit }: { onNavigate: (s: AppState) => void; onExit?: () => void }) {
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white relative overflow-hidden">
      {showAudioSettings && <AudioSettingsOverlay onClose={() => setShowAudioSettings(false)} />}
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,#1e293b_0%,transparent_60%)] opacity-50" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 text-center"
      >
        <h1 className="text-6xl font-bold tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
          THE VAST
        </h1>
        <p className="text-sm font-mono text-gray-500 uppercase tracking-[0.4em] mb-12">
          Deep Space Operations
        </p>

        <div className="flex flex-col gap-4 w-64 mx-auto">
          <MenuButton icon={<Play size={18} />} label="Одиночная игра" onClick={() => onNavigate('WORLD_SELECT')} />
          <MenuButton icon={<UserPlus size={18} />} label="Редактор видов" subtitle="Создание расы" onClick={() => onNavigate('SPECIES_EDITOR')} />
          <MenuButton icon={<Plus size={18} />} label="Редактор кораблей" subtitle="Креативный режим" onClick={() => onNavigate('CREATIVE_EDITOR')} />
          <MenuButton icon={<Globe size={18} />} label="Многопользовательская" onClick={() => onNavigate('MULTIPLAYER_LOBBY')} />
          <MenuButton icon={<Settings size={18} />} label="Настройки" onClick={() => setShowAudioSettings(true)} />
          <MenuButton icon={<LogOut size={18} />} label="Выход" onClick={onExit} danger />
        </div>
      </motion.div>

      <div className="absolute bottom-4 left-4 text-[10px] font-mono text-gray-700">
        {GAME_VERSION} {'// SYSTEM_READY'}
      </div>
    </div>
  );
}

function MenuButton({ icon, label, onClick, disabled, subtitle, danger }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative flex items-center gap-3 px-4 py-3 border border-white/10 bg-white/5 
        transition-all duration-200 
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 hover:border-white/30 active:scale-95'}
        ${danger ? 'hover:border-red-500/50 hover:bg-red-500/5' : ''}
      `}
    >
      <div className={`transition-transform duration-200 group-hover:scale-110 ${danger ? 'text-red-500' : 'text-blue-400'}`}>
        {icon}
      </div>
      <div className="flex flex-col items-start translate-y-[-1px]">
        <span className="text-sm font-medium tracking-wide translate-y-1">{label}</span>
        {subtitle && <span className="text-[9px] uppercase tracking-wider text-gray-500">{subtitle}</span>}
      </div>
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-white/30" />
      <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-white/30" />
    </button>
  );
}

// --- World Selector ---
export function WorldSelector({ onBack, onSelect, onCreate }: { onBack: () => void; onSelect: (save: GameSave) => void; onCreate: () => void }) {
  const [saves, setSaves] = useState<GameSave[]>(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('astraeus_saves');
        return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  const [loading, setLoading] = useState(false);

  const deleteSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saves.filter(s => s.id !== id);
    setSaves(updated);
    localStorage.setItem('astraeus_saves', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-3xl font-bold tracking-tight">Миры</h2>
          </div>
          <button 
            onClick={onCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-bold"
          >
            <Plus size={18} /> Создать новый
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
             <Loader2 className="animate-spin mb-2" />
             <span className="text-xs font-mono uppercase tracking-widest">Scanning local storage...</span>
          </div>
        ) : saves.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/10 bg-white/5">
             <Globe size={48} className="text-gray-700 mb-4" />
             <p className="text-gray-400 mb-2">Миры не обнаружены</p>
             <p className="text-xs text-gray-600 font-mono italic">Sector scanning returns zero signatures.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {saves.sort((a,b) => b.lastPlayedAt - a.lastPlayedAt).map(save => (
              <div 
                key={save.id}
                onClick={() => onSelect(save)}
                className="group relative flex items-center justify-between p-6 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-all text-left cursor-pointer"
              >
                <div>
                  <h3 className="text-xl font-bold text-blue-100 group-hover:text-blue-400 transition-colors">{save.name}</h3>
                  <div className="flex gap-4 mt-1 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                    <span>Сложность: {save.difficulty}</span>
                    <span>Сид: {save.seed}</span>
                    <span>{new Date(save.lastPlayedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Play size={20} className="text-gray-500 group-hover:text-blue-400 transition-all transform group-hover:scale-110" />
                  <button 
                    onClick={(e) => deleteSave(save.id, e)}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-500 transition-all rounded relative z-10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- World Creation ---
export function WorldCreation({ onBack, onComplete }: { onBack: () => void; onComplete: (save: GameSave) => void }) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [name, setName] = useState('Новый Мир');
  const [seed, setSeed] = useState(() => Math.random().toString(36).substring(7).toUpperCase());
  const [difficulty, setDifficulty] = useState<any>('NORMAL');
  const [clusterRadius, setClusterRadius] = useState(500);
  const [density, setDensity] = useState(1);
  
  const [speciesList, setSpeciesList] = useState<SpeciesDefinition[]>(() => {
    if (typeof window !== 'undefined') {
       const stored = localStorage.getItem('astraeus_species');
       return stored ? JSON.parse(stored) : [];
    }
    return [];
  });
  
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [isSpeciesDesignerOpen, setIsSpeciesDesignerOpen] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState<SpeciesDefinition | undefined>(undefined);

  const [orgType, setOrgType] = useState<OrganizationType>('CAPTAIN');
  const [originId, setOriginId] = useState(ORIGINS.filter(o => o.orgType === 'CAPTAIN')[0].id);

  const filteredOrigins = ORIGINS.filter(o => o.orgType === orgType);

  const handleNext = () => {
    if (step < 4) {
      setDirection(1);
      setStep(s => s + 1);
    } else {
      handleCreate();
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(s => s - 1);
    } else {
      onBack();
    }
  };

  const handleCreate = () => {
    const selectedSp = speciesList.find(s => s.id === selectedSpeciesId);

    const newSave: GameSave = {
      id: crypto.randomUUID(),
      name,
      seed,
      difficulty,
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
      clusterRadius,
      density,
      orgType,
      originId,
      species: selectedSp,
      researchedTechs: ['eng_basic_construction'],
      innovationPoints: orgType === 'NOMAD' ? 3 : 0 // Gifting some starting points for nomads
    };
    const existing = JSON.parse(localStorage.getItem('astraeus_saves') || '[]');
    localStorage.setItem('astraeus_saves', JSON.stringify([...existing, newSave]));
    onComplete(newSave);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const RACES = [
    { id: 'HUMAN', label: 'Люди (Земляне)' },
    { id: 'CYBORG', label: 'Киборги Синдиката' },
    { id: 'ALIEN_1', label: 'Креилианцы' }
  ];

  const ORGS = [
    { id: 'STATE', label: 'Государство' },
    { id: 'NOMAD', label: 'Кочевники' },
    { id: 'CAPTAIN', label: 'Капитан' }
  ];

  if (isSpeciesDesignerOpen) {
    return (
      <div className="absolute inset-0 z-50">
         <SpeciesDesigner 
           initialData={editingSpecies}
           onExit={() => {
              setIsSpeciesDesignerOpen(false);
              setEditingSpecies(undefined);
           }}
           onSave={(species) => {
              const existingIdx = speciesList.findIndex(s => s.id === species.id);
              let newList = [...speciesList];
              if (existingIdx >= 0) {
                 newList[existingIdx] = species;
              } else {
                 newList.push(species);
              }
              setSpeciesList(newList);
              setSelectedSpeciesId(species.id);
              localStorage.setItem('astraeus_species', JSON.stringify(newList));
              setIsSpeciesDesignerOpen(false);
              setEditingSpecies(undefined);
           }}
         />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans overflow-hidden flex flex-col">
      <header className="flex items-center gap-4 mb-8 z-10">
        <button onClick={handlePrev} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-3xl font-bold tracking-tight">Создание Мира: Шаг {step} из 4</h2>
      </header>

      <div className="flex-1 relative max-w-2xl w-full mx-auto">
        <AnimatePresence initial={false} custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute w-full"
            >
              <main className="space-y-8">
                <section className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-1 block">Название экспедиции</span>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-4 font-bold text-xl outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-[10px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-1 block">Генераторный Сид</span>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={seed} 
                          onChange={e => setSeed(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 p-2 font-mono text-sm outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <button onClick={() => setSeed(Math.random().toString(36).substring(7).toUpperCase())} className="px-3 bg-white/10 hover:bg-white/20 transition-colors">
                          <Loader2 size={14} />
                        </button>
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-[10px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-1 block">Сложность</span>
                      <select 
                        value={difficulty}
                        onChange={e => setDifficulty(e.target.value)}
                        className="w-full bg-black border border-white/10 p-2 font-mono text-sm outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="EASY">ЛЕГКО</option>
                        <option value="NORMAL">НОРМА</option>
                        <option value="HARD">ТЯЖЕЛО</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section className="space-y-6 pt-6 border-t border-white/10">
                  <h3 className="text-sm font-mono text-gray-500 uppercase tracking-[0.3em]">Параметры Скопления</h3>
                  <div className="space-y-4">
                    <label className="block">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-400 uppercase tracking-widest">Радиус Квадранта</span>
                        <span className="text-xs font-mono text-blue-400">{clusterRadius} св. лет</span>
                      </div>
                      <input 
                        type="range" min="100" max="2000" step="100"
                        value={clusterRadius} onChange={e => setClusterRadius(Number(e.target.value))}
                        className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </label>
                    <label className="block">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-400 uppercase tracking-widest">Плотность тел</span>
                        <span className="text-xs font-mono text-blue-400">{density}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="3" step="0.1"
                        value={density} onChange={e => setDensity(Number(e.target.value))}
                        className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </label>
                  </div>
                </section>
                <div className="pt-8">
                  <button onClick={handleNext} className="w-full py-4 bg-blue-600 hover:bg-blue-500 transition-all font-bold text-lg uppercase tracking-wider">Подтвердить генерацию мира</button>
                </div>
              </main>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute w-full"
            >
              <main className="space-y-8">
                <div className="flex items-center justify-between">
                   <h3 className="text-xl font-bold tracking-tight text-white/80">Выберите вашу расу</h3>
                   <button 
                      onClick={() => { setEditingSpecies(undefined); setIsSpeciesDesignerOpen(true); }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-bold"
                   >
                     <Plus size={16} /> Создать новый вид
                   </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {speciesList.length === 0 ? (
                      <div className="col-span-1 md:col-span-2 p-8 border border-white/10 border-dashed text-center text-neutral-500 text-sm">
                         У вас пока нет сохранённых видов.
                      </div>
                  ) : speciesList.map(sp => (
                    <div
                      key={sp.id}
                      onClick={() => setSelectedSpeciesId(sp.id)}
                      className={`p-6 border transition-all text-left flex gap-4 cursor-pointer relative overflow-hidden group ${selectedSpeciesId === sp.id ? 'border-blue-500 bg-blue-900/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                    >
                      <div className="w-16 h-16 bg-black border border-white/10 shrink-0 self-start mt-1">
                        {sp.portraitDataUrl ? <img src={sp.portraitDataUrl} alt={sp.name} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                           <h4 className="text-lg font-bold">{sp.name || 'Неизвестно'}</h4>
                           <button 
                               onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSpecies(sp);
                                  setIsSpeciesDesignerOpen(true);
                               }}
                               className="text-neutral-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                           >
                              <Settings size={16} />
                           </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">{sp.pluralName} • {sp.adjective}</p>
                        <div className="flex flex-wrap gap-1 mt-3">
                           <span className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded">{sp.speciesClass}</span>
                           <span className="text-[10px] px-2 py-0.5 bg-emerald-900/30 border border-emerald-500/30 text-emerald-300 rounded">{sp.environment}</span>
                           <span className="text-[10px] px-2 py-0.5 bg-purple-900/30 border border-purple-500/30 text-purple-300 rounded">{sp.organization}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-8">
                  <button 
                     onClick={handleNext} 
                     disabled={!selectedSpeciesId && speciesList.length > 0} 
                     className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all font-bold text-lg uppercase tracking-wider"
                  >
                     Далее
                  </button>
                </div>
              </main>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute w-full max-h-[70vh] overflow-y-auto"
            >
              <main className="space-y-8 p-1">
                <h3 className="text-xl font-bold tracking-tight text-white/80">Выберите тип организации</h3>
                <div className="grid grid-cols-1 gap-4">
                  {ORGS.map(o => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setOrgType(o.id as OrganizationType);
                        setOriginId(ORIGINS.filter(org => org.orgType === o.id)[0].id);
                      }}
                      className={`p-6 border transition-all text-left flex flex-col gap-2 ${orgType === o.id ? 'border-green-500 bg-green-900/20 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                    >
                      <h4 className="text-lg font-bold">{o.label}</h4>
                      <p className="text-xs text-gray-400">
                        {o.id === 'STATE' && 'Развитая бюрократия. Автоматическое исследование технологий при наличии университетов.'}
                        {o.id === 'NOMAD' && 'Флот-кочевник. Для изучения случайных технологий требуются очки "Инноваций" и ручное управление.'}
                        {o.id === 'CAPTAIN' && 'Свободный торговец или наемник. Покупайте технологии на станциях, затем интегрируйте их в корабль.'}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="pt-8">
                  <button onClick={handleNext} className="w-full py-4 bg-blue-600 hover:bg-blue-500 transition-all font-bold text-lg uppercase tracking-wider">Далее</button>
                </div>
              </main>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute w-full max-h-[70vh] overflow-y-auto"
            >
               <main className="space-y-8 p-1">
                <h3 className="text-xl font-bold tracking-tight text-white/80">Определите происхождение</h3>
                <div className="flex flex-col gap-4">
                  {filteredOrigins.map(o => (
                    <button
                      key={o.id}
                      onClick={() => setOriginId(o.id)}
                      className={`p-6 border transition-all text-left ${originId === o.id ? 'border-purple-500 bg-purple-900/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                    >
                      <h4 className="text-lg font-bold">{o.name}</h4>
                      <p className="text-sm text-gray-400 mt-2">{o.description}</p>
                      <div className="mt-4 text-xs font-mono text-purple-400">Стартовый бюджет: {o.baseBudget} ₡</div>
                    </button>
                  ))}
                </div>
                <div className="pt-8">
                  <button onClick={handleNext} className="w-full py-6 bg-purple-600 hover:bg-purple-500 transition-all font-black text-xl uppercase tracking-tighter shadow-lg shadow-purple-500/20">Инициировать Прыжок</button>
                </div>
              </main>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Placeholder Settings ---
export function SettingsMenu({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans flex flex-col items-center justify-center">
      <h2 className="text-3xl font-bold mb-4">Настройки</h2>
      <p className="text-gray-500 font-mono mb-8 italic">{"// Subsystem configuration unavailable in alpha"}</p>
      <button onClick={onBack} className="px-8 py-3 bg-white/10 hover:bg-white/20 transition-colors uppercase font-bold tracking-widest text-sm">Назад</button>
    </div>
  );
}

// --- Multiplayer Lobby ---
export function MultiplayerLobby({ onBack, onStartGame }: { onBack: () => void; onStartGame: (save: GameSave, isHost: boolean, roomId: string) => void }) {
    const { socket } = useMultiplayer();
    const [view, setView] = useState<'HOME' | 'JOIN' | 'HOST_SELECT' | 'HOST_CONFIG'>('HOME');
    const [roomId, setRoomId] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<string | null>(null);
    const [selectedWorld, setSelectedWorld] = useState<GameSave | null>(null);

    const [saves] = useState<GameSave[]>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('astraeus_saves');
            return stored ? JSON.parse(stored) : [];
        }
        return [];
    });

    useEffect(() => {
        if (!socket) return;
        socket.on('roomCreated', (id) => {
            setStatus(`Room created! Room ID: ${id}`);
            if (selectedWorld) onStartGame(selectedWorld, true, id);
        });
        socket.on('joined', (id) => {
            setStatus(`Joined room ${id}`);
            // FIXME: How to get the selectedWorld / room setup from host in client?
            // For now, let's just trigger start with a dummy or fetch it.
        });
        socket.on('error', (err) => setStatus(`Error: ${err}`));
        return () => { socket.off('roomCreated'); socket.off('joined'); socket.off('error'); };
    }, [socket, selectedWorld, onStartGame]);

    const handleJoin = () => {
        if (!socket) return;
        socket.emit('joinRoom', roomId, password);
    };

    const handleCreate = () => {
        if (!socket || !selectedWorld) return;
        const newId = Math.random().toString(36).substring(7).toUpperCase();
        setRoomId(newId);
        // FIXME: Pass selectedWorld data to start the game properly
        socket.emit('createRoom', newId, password);
    };

    const handleBack = () => {
        if (view === 'HOME') onBack();
        else setView('HOME');
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold mb-8">Многопользовательская игра</h2>
            
            {view === 'HOME' && (
                <div className="flex flex-col gap-4 w-64">
                    <button onClick={() => setView('HOST_SELECT')} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 transition-colors uppercase font-bold tracking-widest text-sm">Открыть сервер</button>
                    <button onClick={() => setView('JOIN')} className="px-8 py-3 bg-white/10 hover:bg-white/20 transition-colors uppercase font-bold tracking-widest text-sm">Подключиться</button>
                    <button onClick={handleBack} className="px-8 py-3 bg-white/5 hover:bg-white/10 transition-colors uppercase font-bold tracking-widest text-sm">Назад</button>
                </div>
            )}
            
            {view === 'HOST_SELECT' && (
                <div className="flex flex-col gap-4 w-full max-w-lg">
                    {saves.length === 0 ? (
                        <p className="text-gray-500 font-mono text-center">Миры не обнаружены</p>
                    ) : (
                        saves.map(save => (
                             <button key={save.id} onClick={() => { setSelectedWorld(save); setView('HOST_CONFIG'); }} className="p-4 border border-white/10 bg-white/5 hover:bg-blue-900/50 transition-colors text-left">
                                 <h3 className="font-bold">{save.name}</h3>
                                 <p className="text-xs text-gray-400 font-mono">{save.seed}</p>
                             </button>
                        ))
                    )}
                    <button onClick={handleBack} className="px-8 py-3 bg-white/5 hover:bg-white/10 transition-colors uppercase font-bold tracking-widest text-sm">Назад</button>
                </div>
            )}
            
            {view === 'HOST_CONFIG' && selectedWorld && (
                <div className="flex flex-col gap-4 w-64">
                     <p className="mb-2 text-sm text-blue-400 font-mono">Мир: {selectedWorld.name}</p>
                    <input type="password" placeholder="Пароль для сервера" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white/5 border border-white/10 p-3 outline-none" />
                    <button onClick={handleCreate} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 transition-colors uppercase font-bold tracking-widest text-sm">Открыть сервер</button>
                    <button onClick={() => setView('HOST_SELECT')} className="px-8 py-3 bg-white/5 hover:bg-white/10 transition-colors uppercase font-bold tracking-widest text-sm">Назад</button>
                    {status && <p className="text-xs font-mono text-green-500">{status}</p>}
                    {roomId && <p className="text-xs font-mono text-blue-400">Room ID: {roomId}</p>}
                </div>
            )}
            
            {view === 'JOIN' && (
                <div className="flex flex-col gap-4 w-64">
                    <input type="text" placeholder="ID игры (Room ID)" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="bg-white/5 border border-white/10 p-3 outline-none" />
                    <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white/5 border border-white/10 p-3 outline-none" />
                    <button onClick={handleJoin} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 transition-colors uppercase font-bold tracking-widest text-sm">Подключиться</button>
                    <button onClick={handleBack} className="px-8 py-3 bg-white/5 hover:bg-white/10 transition-colors uppercase font-bold tracking-widest text-sm">Назад</button>
                    {status && <p className={`text-xs font-mono ${status.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>{status}</p>}
                </div>
            )}
        </div>
    )
}

