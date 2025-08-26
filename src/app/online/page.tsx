
"use client";

import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { findAndJoinGame, type Game, findAvailableGames, joinGame } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Swords, Scissors, Layers, Loader2, RefreshCw } from 'lucide-react';
import type { GameType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function OnlineLobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslation();
  const { toast } = useToast();

  const [isMatching, setIsMatching] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [matchingGameType, setMatchingGameType] = useState<GameType | null>(null);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);

  const fetchGames = async () => {
    if(!user) return;
    const games = await findAvailableGames();
    // Filter out games created by the current user from the list
    setAvailableGames(games.filter(g => !g.playerIds.includes(user.uid)));
  };

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);
  
  const handleMatchmaking = async (gameType: GameType) => {
    if (!user || isMatching) return;

    setIsMatching(true);
    setMatchingGameType(gameType);

    try {
      const gameId = await findAndJoinGame(user, gameType);
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

  const handleJoinGame = async (gameId: string, gameType: GameType) => {
    if (!user) return;
    setIsJoining(gameId);
    try {
        await joinGame(gameId, user);
        router.push(`/${gameType}/${gameId}`);
    } catch (error) {
        console.error("Failed to join game:", error);
        toast({
            title: "Error",
            description: "Failed to join the game. It might be full or no longer available.",
            variant: "destructive"
        });
        setIsJoining(null);
        fetchGames(); // Refresh list
    }
  };

  const GameCard = ({ gameType, icon: Icon, disabled = false }: { gameType: GameType; icon: React.ElementType, disabled?: boolean }) => (
    <Card className={`text-center ${disabled || isMatching ? 'bg-muted/50' : ''}`}>
      <CardHeader>
        <div className="flex justify-center mb-4">
          <Icon className={`w-12 h-12 ${disabled || isMatching ? 'text-muted-foreground' : 'text-primary'}`} />
        </div>
        <CardTitle className={disabled || isMatching ? 'text-muted-foreground' : ''}>{t(`${gameType}Title`)}</CardTitle>
      </CardHeader>
      <CardContent>
        {isMatching && matchingGameType === gameType ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-muted-foreground">{t('autoMatching')}</p>
          </div>
        ) : (
          <Button onClick={() => handleMatchmaking(gameType)} disabled={isMatching || disabled}>
            {disabled ? t('comingSoon') : t('autoMatch')}
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
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle>{t('joinGame')}</CardTitle>
                <CardDescription>{t('orJoinWaitingGame')}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchGames}><RefreshCw className="h-5 w-5"/></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            {availableGames.length > 0 ? (
                availableGames.map(game => (
                    <div key={game.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarImage src={game.players[game.playerIds[0]].photoURL ?? undefined}/>
                                <AvatarFallback>{game.players[game.playerIds[0]].displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold">{game.players[game.playerIds[0]].displayName}</p>
                                <p className="text-sm text-muted-foreground">{t(`${game.gameType}Title`)}</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => handleJoinGame(game.id, game.gameType)}
                            disabled={isJoining === game.id}
                        >
                            {isJoining === game.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            {t('joinGame')}
                        </Button>
                    </div>
                ))
            ) : (
                <p className="text-center text-muted-foreground">{t('noGamesAvailable')}</p>
            )}
        </CardContent>
      </Card>

    </div>
  );
}
