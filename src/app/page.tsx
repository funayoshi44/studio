
"use client";

import Link from 'next/link';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DifficultySelector } from '@/components/difficulty-selector';
import { Swords, Scissors, Layers, Users, Eye, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getCards } from '@/lib/firestore';
import type { CardData } from '@/lib/types';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { PokerCard } from '@/components/ui/poker-card';

export default function HomePage() {
  const t = useTranslation();
  const [cards, setCards] = useState<CardData[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);

  useEffect(() => {
    const fetchCards = async () => {
      setIsLoadingCards(true);
      try {
        const fetchedCards = await getCards();
        setCards(fetchedCards);
      } catch (error) {
        console.error("Failed to fetch cards:", error);
      } finally {
        setIsLoadingCards(false);
      }
    };
    fetchCards();
  }, []);


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

      <div className="w-full max-w-6xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

        {/* Card Gallery Section */}
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Eye className="w-8 h-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Card Gallery</CardTitle>
                <CardDescription>Browse the collection of registered cards.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingCards ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="ml-2">Loading cards...</p>
              </div>
            ) : cards.length > 0 ? (
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                }}
                className="w-full max-w-5xl mx-auto"
              >
                <CarouselContent className="-ml-2">
                  {cards.map((card, index) => (
                    <CarouselItem key={card.id} className="pl-2 basis-1/2 md:basis-1/3 lg:basis-1/5">
                      <div className="p-1">
                          <PokerCard card={card} revealed={true} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex" />
                <CarouselNext className="hidden sm:flex" />
              </Carousel>
            ) : (
              <p className="text-center text-muted-foreground">No cards found in the gallery.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
