"use client";

import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import type { Difficulty, Language, GameHistory, GameType } from '@/lib/types';

const defaultHistory: GameHistory = {
  duel: { easy: { wins: 0, losses: 0 }, normal: { wins: 0, losses: 0 }, hard: { wins: 0, losses: 0 } },
  janken: { easy: { wins: 0, losses: 0 }, normal: { wins: 0, losses: 0 }, hard: { wins: 0, losses: 0 } },
  poker: { easy: { wins: 0, losses: 0 }, normal: { wins: 0, losses: 0 }, hard: { wins: 0, losses: 0 } }
};

type GameContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  difficulty: Difficulty;
  setDifficulty: (diff: Difficulty) => void;
  history: GameHistory;
  recordGameResult: (gameType: GameType, result: 'win' | 'loss') => void;
  clearHistory: () => void;
};

export const GameContext = createContext<GameContextType>({
  language: 'en',
  setLanguage: () => {},
  difficulty: 'normal',
  setDifficulty: () => {},
  history: defaultHistory,
  recordGameResult: () => {},
  clearHistory: () => {},
});

export function GameProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [history, setHistory] = useState<GameHistory>(defaultHistory);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('gameHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
      const storedLang = localStorage.getItem('cardverse-lang') as Language;
      if (storedLang) {
        setLanguage(storedLang);
      }
    } catch (error) {
      console.error("Failed to read from localStorage", error);
    }
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem('gameHistory', JSON.stringify(history));
      } catch (error) {
        console.error("Failed to write to localStorage", error);
      }
    }
  }, [history, isMounted]);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    if(isMounted) {
      localStorage.setItem('cardverse-lang', lang);
    }
  };

  const recordGameResult = useCallback((gameType: GameType, result: 'win' | 'loss') => {
    setHistory(prevHistory => {
      const newHistory = { ...prevHistory };
      const newStats = { ...newHistory[gameType][difficulty] };
      if (result === 'win') {
        newStats.wins++;
      } else {
        newStats.losses++;
      }
      newHistory[gameType][difficulty] = newStats;
      return newHistory;
    });
  }, [difficulty]);

  const clearHistory = useCallback(() => {
    setHistory(defaultHistory);
  }, []);

  const value = {
    language,
    setLanguage: handleSetLanguage,
    difficulty,
    setDifficulty,
    history,
    recordGameResult,
    clearHistory,
  };

  if (!isMounted) {
    return null; 
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
