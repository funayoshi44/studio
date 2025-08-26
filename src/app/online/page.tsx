"use client";

import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { findAndJoinGame, type Game } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Swords, Scissors, Layers, Loader2 } from 'lucide-react';
import type { GameType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function OnlineLobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslation();
  const { toast } = useToast();

  const [isMatching, setIsMatching] = useState(false);
  const [matchingGameType, setMatchingGameType] = useState<GameType | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);
  
  const handleMatchmaking = async (gameType: GameType) => {
    if (!user || isMatching) return;

    setIsMatching(true);
    setMatchingGameType(gameType);

    try {
      // This function will now create a new game or join an existing one.
      const gameId = await findAndJoinGame(user, gameType);
      // Once we have a gameId, we can redirect to the game page.
      // The game page will handle the "waiting" state.
      router.push(`/${gameType}/${gameId}`);

    } catch (error) {
      console.error("Failed to find or create game:", error);
      toast({
        title: "Error",
        description: "Could not start or find a game. Please try again.",
        variant: "destructive"
      });
      setIsMatching(false);
      setMatchingGameType(null);
    }
  };

  const GameCard = ({ gameType, icon: Icon, disabled = false }: { gameType: GameType; icon: React.ElementType, disabled?: boolean }) => (
    <Card className={`text-center ${disabled ? 'bg-muted/50' : ''}`}>
      <CardHeader>
        <div className="flex justify-center mb-4">
          <Icon className={`w-12 h-12 ${disabled ? 'text-muted-foreground' : 'text-primary'}`} />
        </div>
        <CardTitle className={disabled ? 'text-muted-foreground' : ''}>{t(`${gameType}Title`)}</CardTitle>
      </CardHeader>
      <CardContent>
        {isMatching && matchingGameType === gameType ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-muted-foreground">{t('autoMatching')}</p>
          </div>
        ) : (
          <Button onClick={() => handleMatchmaking(gameType)} disabled={isMatching || disabled}>
            {disabled ? 'Coming Soon' : t('autoMatch')}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto">
      <h1 className="text-4xl font-bold text-center mb-8">{t('onlineLobby')}</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('findMatch')}</CardTitle>
          <CardDescription>{t('findMatchDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <GameCard gameType="duel" icon={Swords} />
          <GameCard gameType="janken" icon={Scissors} disabled />
          <GameCard gameType="poker" icon={Layers} disabled />
        </CardContent>
      </Card>
    </div>
  );
}
