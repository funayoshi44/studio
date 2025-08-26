"use client";

import { useContext } from 'react';
import { GameContext } from '@/contexts/game-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { GameType, Difficulty } from '@/lib/types';

export default function HistoryPage() {
  const { history, clearHistory } = useContext(GameContext);
  const t = useTranslation();

  const handleClearHistory = () => {
    if (window.confirm(t('clearHistoryConfirm'))) {
      clearHistory();
    }
  };

  const gameTypes: GameType[] = ['duel', 'janken', 'poker'];
  const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8">{t('historyTitle')}</h1>
      
      <div className="mb-6 space-x-4">
        <Button onClick={handleClearHistory} variant="destructive">
          {t('clearHistory')}
        </Button>
        <Link href="/" passHref>
          <Button variant="secondary">{t('backToMenu')}</Button>
        </Link>
      </div>

      <div className="w-full max-w-4xl space-y-6">
        {gameTypes.map((gameType) => (
          <Card key={gameType} className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t(`${gameType}Title`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {difficulties.map((difficulty) => {
                  const stats = history[gameType]?.[difficulty] ?? { wins: 0, losses: 0 };
                  const total = stats.wins + stats.losses;
                  const winRate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0.0';

                  return (
                    <Card key={difficulty} className="bg-background/50">
                      <CardHeader>
                        <CardTitle className="capitalize">{t(difficulty)}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p>{t('wins')}: {stats.wins}</p>
                        <p>{t('losses')}: {stats.losses}</p>
                        <p>{t('winRate')}: {winRate}%</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
