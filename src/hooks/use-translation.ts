"use client";

import { useContext } from 'react';
import { GameContext } from '@/contexts/game-context';
import { translations } from '@/lib/i18n';

type TranslationKey = keyof typeof translations['en'];

export const useTranslation = () => {
  const { language } = useContext(GameContext);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return t;
};
