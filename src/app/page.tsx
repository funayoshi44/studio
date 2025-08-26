
"use client";

import { useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { GameContext } from '@/contexts/game-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Scissors, Swords, Layers, Users } from 'lucide-react';
import { DifficultySelector } from '@/components/difficulty-selector';

const games = [
  { id: 'duel', href: '/duel', icon: Swords },
  { id: 'janken', href: '/janken', icon: Scissors },
  { id: 'poker', href: '/poker', icon: Layers },
];

export default function Home() {
  const { difficulty } = useContext(GameContext);
  const t = useTranslation();

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
        {t('appName')}
      </h1>

      <div className="mb-8 w-full max-w-4xl">
        <Image
          src="https://poetryfactory.jp/wp-content/uploads/2023/08/%E3%82%B5%E3%83%A0%E3%83%8D%EF%BC%88%E4%BB%AE%EF%BC%89.png"
          alt="A placeholder image showing a beautiful landscape."
          width={800}
          height={400}
          className="rounded-lg shadow-md object-cover w-full"
          data-ai-hint="beautiful landscape"
        />
      </div>
      
      <Card className="w-full max-w-lg mb-12 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-4">
            <Users className="w-10 h-10 text-accent" />
            {t('onlinePlay')}
          </CardTitle>
          <CardDescription>{t('onlinePlayDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/online" passHref>
            <Button size="lg">{t('goToLobby')}</Button>
          </Link>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">{t('playWithAI')}</h2>
        <div className="mb-8">
            <h3 className="text-xl font-bold mb-4">{t('selectDifficulty')}</h3>
            <DifficultySelector />
        </div>
      </div>
      
      <div className="w-full max-w-4xl mx-auto grid md:grid-cols-3 gap-6 mb-8">
        {games.map((game) => (
          <Link href={game.href} key={game.id} passHref>
            <Card className="h-full bg-card/80 backdrop-blur-sm hover:bg-card/100 hover:scale-105 transition-all duration-300 cursor-pointer flex flex-col">
              <CardHeader>
                <CardTitle className="flex flex-col items-center gap-4">
                  <game.icon className="w-12 h-12 text-primary" />
                  {t(`${game.id}Title`)}
                </CardTitle>
                <CardDescription>{t(`${game.id}Description`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      
      <div className="mt-8">
        <Link href="/history" passHref>
          <Button size="lg" variant="secondary">
            <BarChart3 className="mr-2 h-5 w-5" />
            {t('playHistory')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
