"use client";

import { useContext } from 'react';
import { GameContext } from '@/contexts/game-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Difficulty } from '@/lib/types';

const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];

export function DifficultySelector() {
  const { difficulty, setDifficulty } = useContext(GameContext);
  const t = useTranslation();

  const getVariant = (diff: Difficulty) => {
    if (diff === difficulty) {
      if (diff === 'easy') return 'default';
      if (diff === 'normal') return 'default';
      if (diff === 'hard') return 'destructive';
    }
    return 'secondary';
  };
  
  const getRingColor = (diff: Difficulty) => {
    if (diff === 'easy') return 'ring-green-500';
    if (diff === 'normal') return 'ring-yellow-500';
    if (diff === 'hard') return 'ring-red-500';
    return '';
  }

  return (
    <div className="flex justify-center space-x-4">
      {difficulties.map((d) => (
        <Button
          key={d}
          onClick={() => setDifficulty(d)}
          variant={difficulty === d ? 'default' : 'secondary'}
          size="lg"
          className={cn(
            "capitalize transition-all duration-300",
            difficulty === d && 'ring-2 ring-offset-2',
            difficulty === d && getRingColor(d),
            d === 'easy' && difficulty === 'easy' && 'bg-green-600 hover:bg-green-700',
            d === 'normal' && difficulty === 'normal' && 'bg-yellow-600 hover:bg-yellow-700',
            d === 'hard' && difficulty === 'hard' && 'bg-red-600 hover:bg-red-700'
          )}
        >
          {t(d)}
        </Button>
      ))}
    </div>
  );
}
