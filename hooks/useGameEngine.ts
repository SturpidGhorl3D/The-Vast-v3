
import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '@/game/engine/GameEngine';

export function useGameEngine(canvasRef: React.RefObject<HTMLCanvasElement | null>, seed?: string, clusterRadius?: number, density?: number) {
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const newEngine = new GameEngine(canvasRef.current);
    setEngine(newEngine);

    newEngine.init(seed, clusterRadius, density).then(() => {
      setIsReady(true);
    });

    return () => {
      newEngine.destroy();
    };
  }, [canvasRef, seed, clusterRadius, density]);

  return { engine, isReady };
}
