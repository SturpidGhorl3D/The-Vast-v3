'use client';

import React from 'react';

interface StatRowProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  step: number;
  field: string;
  cfg: string;
  update: (f: string, v: any, sf?: string) => void;
  fixed?: number;
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  unit,
  min,
  step,
  field,
  cfg,
  update,
  fixed,
}) => {
  const fmt = (v: number) => fixed !== undefined ? v.toFixed(fixed) : String(Math.round(v));
  return (
    <div className="flex justify-between items-center">
      <span className="opacity-70">{label}:</span>
      <div className="flex items-center gap-1">
        <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => update(cfg, Math.max(min, (value || 0) - step), field)}>−</button>
        <span className="w-14 text-center text-blue-300">{fmt(value)}{unit}</span>
        <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => update(cfg, (value || 0) + step, field)}>+</button>
      </div>
    </div>
  );
};

interface TurretConfigPanelProps {
  comp: any;
  px: string;
  updateField: (f: string, v: any, sf?: string) => void;
  setEditorMode: any;
  engine: any;
}

export const TurretConfigPanel: React.FC<TurretConfigPanelProps> = ({
  comp,
  px,
  updateField,
  setEditorMode,
  engine,
}) => {
  const isWeapon = comp.type === 'WEAPON';
  const cfgName = comp.type === 'MINING' ? 'miningConfig' : 'turretConfig';
  const cfg = comp[cfgName];
  if (!cfg) return null;

  return (
    <div className="space-y-1.5 text-[9px] border-t border-white/10 pt-1.5 mt-1.5">
      <div className="text-[8px] opacity-40 uppercase font-black tracking-tighter text-blue-400">Turret Parameters</div>

      {isWeapon && cfg.fireMode && (
        <div>
          <div className="opacity-50 mb-0.5">Fire Mode:</div>
          <div className="flex gap-1">
            {(['ROUNDS', 'BEAM', 'HOMING'] as const).map(m => (
              <button
                key={m}
                className={`flex-1 py-0.5 border text-[8px] ${cfg.fireMode === m ? 'bg-blue-500/30 border-blue-400 text-blue-300' : 'bg-white/5 border-white/20 hover:bg-white/10'}`}
                onClick={() => updateField(cfgName, m, 'fireMode')}
              >{m}</button>
            ))}
          </div>
        </div>
      )}

      {isWeapon && (
        <div>
          <div className="opacity-50 mb-0.5">Weapon Group:</div>
          <div className="flex gap-1">
            {(['MAIN', 'SECONDARY', 'DEFENCE'] as const).map(g => (
              <button
                key={g}
                className={`flex-1 py-0.5 border text-[8px] ${cfg.weaponGroup === g ? 'bg-orange-500/30 border-orange-400 text-orange-300' : 'bg-white/5 border-white/20 hover:bg-white/10'}`}
                onClick={() => updateField(cfgName, g, 'weaponGroup')}
              >{g === 'MAIN' ? 'MAIN' : g === 'SECONDARY' ? 'SEC' : 'DEF'}</button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="opacity-50 mb-0.5">Mount side:</div>
        <div className="flex gap-1">
          {(['DORSAL', 'VENTRAL', 'NONE'] as const).map(m => (
            <button
              key={m}
              className={`flex-1 py-0.5 border text-[8px] ${cfg.mount === m ? 'bg-purple-500/30 border-purple-400 text-purple-300' : 'bg-white/5 border-white/20 hover:bg-white/10'}`}
              onClick={() => updateField(cfgName, m, 'mount')}
            >{m}</button>
          ))}
        </div>
        {cfg.mount !== 'NONE' && (
          <button 
             className="w-full mt-1 py-1 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-[10px] font-bold"
             onClick={() => {
                setEditorMode('EDIT_TURRET' as any);
                engine.setEditorMode('EDIT_TURRET' as any);
             }}
          >
             🎨 DESIGN TURRET
          </button>
        )}
      </div>

      {(isWeapon ? (cfg.fireMode === 'ROUNDS' || cfg.fireMode === 'BEAM') : true) && (
        <div className="flex justify-between items-center">
          <span className="opacity-50">Barrels:</span>
          <div className="flex items-center gap-0.5">
            <button className="px-1 bg-white/10 hover:bg-white/20 rounded" onClick={() => updateField(cfgName, Math.max(1, (cfg.barrelCount ?? 1) - 1), 'barrelCount')}>−</button>
            <span className="w-5 text-center font-bold text-blue-300">{cfg.barrelCount ?? 1}</span>
            <button className="px-1 bg-white/10 hover:bg-white/20 rounded" onClick={() => updateField(cfgName, Math.min(8, (cfg.barrelCount ?? 1) + 1), 'barrelCount')}>+</button>
          </div>
        </div>
      )}

      {isWeapon && cfg.fireMode === 'HOMING' && (
        <div className="flex justify-between items-center">
          <span className="opacity-50">Shafts:</span>
          <div className="flex items-center gap-0.5">
            <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField(cfgName, Math.max(1, (cfg.shaftCount ?? 1) - 1), 'shaftCount')}>−</button>
            <span className="w-5 text-center">{cfg.shaftCount ?? 1}</span>
            <button className="px-1 bg-white/10 hover:bg-white/20" onClick={() => updateField(cfgName, Math.min(12, (cfg.shaftCount ?? 1) + 1), 'shaftCount')}>+</button>
          </div>
        </div>
      )}

      {isWeapon && <StatRow label="Damage" value={cfg.damage} unit="" min={5} step={5} field="damage" cfg={cfgName} update={updateField} />}
      <StatRow label="Range" value={Math.round(cfg.range)} unit="m" min={100} step={100} field="range" cfg={cfgName} update={updateField} />
      {isWeapon && <StatRow label="Rate" value={cfg.rateOfFire} unit="/s" min={0.1} step={0.1} field="rateOfFire" cfg={cfgName} update={updateField} fixed={1} />}
      {isWeapon && cfg.fireMode === 'ROUNDS' && <StatRow label="Speed" value={cfg.projectileSpeed} unit="m/s" min={100} step={50} field="projectileSpeed" cfg={cfgName} update={updateField} />}
      {isWeapon && cfg.fireMode === 'BEAM' && <StatRow label="Duration" value={cfg.beamDuration} unit="s" min={0.1} step={0.1} field="beamDuration" cfg={cfgName} update={updateField} fixed={1} />}
      {isWeapon && cfg.fireMode === 'HOMING' && <StatRow label="Tracking" value={cfg.homingStrength} unit="" min={0.1} step={0.1} field="homingStrength" cfg={cfgName} update={updateField} fixed={1} />}

      <div className="p-1.5 bg-blue-500/5 border border-blue-500/20 rounded mt-1 opacity-80">
        <div className="text-[7px] uppercase mb-0.5 text-blue-300 font-bold">Effective Output (at lvl {cfg.level || 0})</div>
        <div className="flex justify-between items-center text-[8px]">
          <span>Effective Range:</span>
          <span className="text-blue-300">{(cfg.range * (1 + (cfg.level || 0) * 0.2)).toFixed(0)}m</span>
        </div>
        {!isWeapon && (
          <div className="flex justify-between items-center text-[8px]">
            <span>Effective Rate:</span>
            <span className="text-green-300">Scales with Volume</span>
          </div>
        )}
      </div>
    </div>
  );
};
