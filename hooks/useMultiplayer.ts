
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useMultiplayer(isActive: boolean = true) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');

  useEffect(() => {
    if (!isActive) return;
    const s = io();
    setSocket(s);
    setStatus('CONNECTING');

    s.on('connect', () => {
      setStatus('CONNECTED');
    });

    s.on('disconnect', () => {
      setStatus('DISCONNECTED');
    });

    return () => {
      s.disconnect();
    };
  }, [isActive]);

  const emitGameInput = (roomId: string, input: any) => {
    socket?.emit('gameInput', { roomId, ...input });
  };

  const onGameInput = (callback: (data: any) => void): () => void => {
    socket?.on('gameInput', callback);
    return () => socket?.off('gameInput', callback);
  };

  const emitGameStateUpdate = (roomId: string, state: any) => {
    socket?.emit('gameStateUpdate', { roomId, ...state });
  };

  const onGameStateUpdate = (callback: (data: any) => void): () => void => {
    socket?.on('gameStateUpdate', callback);
    return () => socket?.off('gameStateUpdate', callback);
  };

  const onPlayerDisconnected = (callback: (data: { playerId: string }) => void): () => void => {
    socket?.on('playerDisconnected', callback);
    return () => socket?.off('playerDisconnected', callback);
  };

  return { socket, socketId: socket?.id, status, emitGameInput, onGameInput, emitGameStateUpdate, onGameStateUpdate, onPlayerDisconnected };
}
