
'use client';

import { useState, useEffect } from 'react';
import { audioManager } from '@/game/engine/AudioManager';
import GameCanvas from '@/components/GameCanvas';
import { MainMenu, WorldSelector, WorldCreation, MultiplayerLobby, SettingsMenu, type AppState, type GameSave } from '@/components/ui/main-menu/MainMenu';
import StarterShipSelector from '@/components/ui/StarterShipSelector';
import SpeciesDesigner from '@/components/ui/species-editor/SpeciesDesigner';
import type { ShipHull } from '@/components/game/types';

export default function Home() {
  useEffect(() => {
    const initAudio = () => {
      audioManager.init();
      document.removeEventListener('click', initAudio);
    };
    document.addEventListener('click', initAudio);
  }, []);

  const [appState, setAppState] = useState<AppState>('MAIN_MENU');
  const [activeSave, setActiveSave] = useState<GameSave | null>(null);
  const [multiplayerInfo, setMultiplayerInfo] = useState<{ isHost: boolean; roomId: string } | null>(null);
  
  const [showShipSelector, setShowShipSelector] = useState(false);
  const [pendingSaveForShip, setPendingSaveForShip] = useState<GameSave | null>(null);

  const handleStartGame = (save: GameSave) => {
    // Check if player data exists for this world
    const playerStoreKey = `thevast-player-${save.id}`;
    const playerExists = typeof window !== 'undefined' && localStorage.getItem(playerStoreKey);
    
    if (!playerExists) {
      setPendingSaveForShip(save);
      setShowShipSelector(true);
    } else {
      setActiveSave(save);
      setAppState('IN_GAME');
    }
  };

  const handleShipSelected = (hull: ShipHull) => {
    if (!pendingSaveForShip) return;
    
    const playerStoreKey = `thevast-player-${pendingSaveForShip.id}`;
    localStorage.setItem(playerStoreKey, JSON.stringify({
      shipHull: hull,
      inventory: { IRON: 100, TITANIUM: 50 },
      playerPosition: null
    }));

    setActiveSave(pendingSaveForShip);
    setAppState('IN_GAME');
    setShowShipSelector(false);
    setPendingSaveForShip(null);
  };

  const handleBackToMenu = () => {
    setAppState('MAIN_MENU');
    setActiveSave(null);
    setMultiplayerInfo(null);
  };

  return (
    <main className="min-h-screen bg-black">
      {appState === 'MAIN_MENU' && <MainMenu onNavigate={setAppState} />}
      
      {appState === 'WORLD_SELECT' && (
        <WorldSelector 
          onBack={() => setAppState('MAIN_MENU')} 
          onSelect={handleStartGame}
          onCreate={() => setAppState('WORLD_CREATION')}
        />
      )}

      {appState === 'WORLD_CREATION' && (
        <WorldCreation 
          onBack={() => setAppState('WORLD_SELECT')} 
          onComplete={handleStartGame}
        />
      )}

      {appState === 'SETTINGS' && (
        <SettingsMenu onBack={() => setAppState('MAIN_MENU')} />
      )}

      {appState === 'MULTIPLAYER_LOBBY' && (
        <MultiplayerLobby onBack={() => setAppState('MAIN_MENU')} onStartGame={(save, isHost, roomId) => {
            setMultiplayerInfo({ isHost, roomId });
            handleStartGame(save);
        }} />
      )}

      {showShipSelector && (
        <StarterShipSelector 
          onSelect={handleShipSelected}
          onCancel={() => {
            setShowShipSelector(false);
            setPendingSaveForShip(null);
          }}
        />
      )}


      {appState === 'IN_GAME' && activeSave && (
        <GameCanvas save={activeSave} multiplayerInfo={multiplayerInfo} onExit={handleBackToMenu} />
      )}

      {appState === 'CREATIVE_EDITOR' && (
        <GameCanvas 
          save={{ id: 'creative', name: 'Creative Mode', seed: 'CREATIVE', difficulty: 'NORMAL', createdAt: 0, lastPlayedAt: 0, clusterRadius: 0, density: 1, orgType: 'CAPTAIN', originId: 'captain-freelance' }} 
          isCreative={true}
          multiplayerInfo={null}
          onExit={handleBackToMenu} 
        />
      )}

      {appState === 'SPECIES_EDITOR' && (
        <SpeciesDesigner onExit={handleBackToMenu} />
      )}
    </main>
  );
}
