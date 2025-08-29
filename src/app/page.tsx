
"use client";

import Link from 'next/link';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DifficultySelector } from '@/components/difficulty-selector';
import { Swords, Scissors, Layers, Users, Eye, Loader2, Megaphone, HelpCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { subscribeToLatestAnnouncements, type Announcement, type CardData } from '@/lib/firestore';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { PokerCard } from '@/components/ui/poker-card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useCardCache } from '@/contexts/card-cache-context';

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const GuessTheCardGame = ({ allCards }: { allCards: CardData[] }) => {
    const [gameCards, setGameCards] = useState<CardData[]>([]);
    const [revealed, setRevealed] = useState(false);
    const [result, setResult] = useState<'win' | 'lose' | null>(null);

    const setupGame = useCallback(() => {
        if (allCards.length < 3) return;

        const jokers = allCards.filter(c => c.rank === 'Joker' || c.rank === 0);
        const nonJokers = allCards.filter(c => c.rank !== 'Joker' && c.rank !== 0);
        
        if (jokers.length === 0 || nonJokers.length < 2) return;

        const winningCard = jokers[Math.floor(Math.random() * jokers.length)];
        const losingCards = shuffleArray(nonJokers).slice(0, 2);
        
        setGameCards(shuffleArray([winningCard, ...losingCards]));
        setRevealed(false);
        setResult(null);
    }, [allCards]);

    useEffect(() => {
        setupGame();
    }, [setupGame]);

    const handleCardClick = (card: CardData) => {
        if (revealed) return;
        setRevealed(true);
        if (card.rank === 'Joker' || card.rank === 0) {
            setResult('win');
        } else {
            setResult('lose');
        }
    };
    
    if (gameCards.length < 3) {
        return (
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3"><HelpCircle className="w-8 h-8 text-primary" /> Guess the Card!</CardTitle>
                    <CardDescription>Not enough cards to play. Please add at least 3 cards (including one Joker) in the admin panel.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <HelpCircle className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle className="text-2xl">Guess the Card!</CardTitle>
                        <CardDescription>Find the Joker card. Click on a card to guess.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-center gap-4 mb-4">
                    {gameCards.map((card, index) => (
                        <button key={index} onClick={() => handleCardClick(card)} disabled={revealed}>
                           <PokerCard card={card} revealed={revealed} />
                        </button>
                    ))}
                </div>
                {result && (
                    <div className="text-center space-y-2">
                        <p className={cn("text-2xl font-bold", result === 'win' ? 'text-accent' : 'text-destructive')}>
                            {result === 'win' ? 'You Win!' : 'Try Again!'}
                        </p>
                        <Button onClick={setupGame}>Play Again</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default function HomePage() {
  const { t, language } = useTranslation();
  const { cards, loading: isLoadingCards } = useCardCache();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);

  useEffect(() => {
    const unsubscribeAnnouncements = subscribeToLatestAnnouncements((data) => {
        setAnnouncements(data);
        setIsLoadingAnnouncements(false);
    });

    return () => {
        unsubscribeAnnouncements();
    }
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

         {/* Announcements Section */}
        {isLoadingAnnouncements ? (
             <Card><CardContent className="p-6"><Loader2 className="mx-auto animate-spin" /></CardContent></Card>
        ) : announcements.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-3">
                    <Megaphone className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle className="text-2xl">Announcements</CardTitle>
                        <CardDescription>Latest news from the administrators.</CardDescription>
                    </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {announcements.map(item => (
                             <AccordionItem value={item.id} key={item.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4">
                                        <span>{item.title}</span>
                                        <span className="text-sm text-muted-foreground font-normal">
                                            {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true, locale: language === 'ja' ? ja : undefined })}
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="whitespace-pre-wrap text-muted-foreground">
                                    {item.content}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        )}


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
                  loop: cards.length > 5, // Only loop if there are enough cards
                }}
                className="w-full max-w-5xl mx-auto"
              >
                <CarouselContent className="-ml-2">
                  {cards.map((card) => (
                    <CarouselItem key={card.id} className="pl-2 basis-1/2 md:basis-1/3 lg:basis-1/5">
                      <div className="p-1">
                        <Link href={`/cards/${card.id}`}>
                           <PokerCard card={card} revealed={true} />
                        </Link>
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

        {/* Guess the Card Game Section */}
        {!isLoadingCards && <GuessTheCardGame allCards={cards} />}

      </div>
    </div>
  );
}
