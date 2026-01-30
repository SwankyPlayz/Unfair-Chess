import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  playerName: string;
  playerId: string;
  setPlayerName: (name: string) => void;
}

function generatePlayerId(): string {
  return 'player_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      playerName: 'Player',
      playerId: generatePlayerId(),
      setPlayerName: (name: string) => set({ playerName: name }),
    }),
    {
      name: 'unfair-chess-player',
    }
  )
);
