
"use client";

import Link from 'next/link';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DifficultySelector } from '@/components/difficulty-selector';
import { Swords, Scissors, Layers, Users } from 'lucide-react';

export default function HomePage() {
  const t = useTranslation();

  const games = [
    { name: 'duel', href: '/duel', icon: Swords },
    { name: 'janken', href: '/janken', icon: Scissors },
    { name: 'poker', href: '/poker', icon: Layers },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-primary">
          {t('appName')}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t('onlinePlayDescription')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Play Online Card */}
        <Card className="md:col-span-2 transform hover:scale-[1.02] transition-transform duration-300 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Users className="w-10 h-10 text-primary" />
              <div>
                <CardTitle className="text-3xl">{t('onlinePlay')}</CardTitle>
                <CardDescription>{t('onlinePlayDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/online">
              <Button size="lg" className="w-full text-lg">{t('goToLobby')}</Button>
            </Link>
          </CardContent>
        </Card>

        {/* AI Opponent Card */}
        <Card className="md:col-span-2 bg-card/80 backdrop-blur-sm">
           <CardHeader className="text-center">
            <CardTitle className="text-3xl">{t('playWithAI')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4 text-muted-foreground">{t('selectDifficulty')}</p>
            <DifficultySelector />
          </CardContent>
        </Card>
        
        {games.map((game) => (
          <Card key={game.name} className="flex flex-col transform hover:scale-105 transition-transform duration-300">
            <CardHeader className="flex-row items-center gap-4 pb-4">
              <game.icon className="w-8 h-8 text-accent" />
              <CardTitle>{t(`${game.name}Title` as any)}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
              <CardDescription className="mb-4">
                {t(`${game.name}Description` as any)}
              </CardDescription>
              <Link href={game.href} passHref>
                <Button className="w-full mt-auto">{t(game.name as any)}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
