
"use client";

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { findAndJoinGame, type Game, findAvailableGames, joinGame } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Swords, Scissors, Layers, Loader2, RefreshCw, LogIn } from 'lucide-react';
import type { GameType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OnlineLobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslation();
  const { toast } = useToast();

  const [isMatching, setIsMatching] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [matchingGameType, setMatchingGameType] = useState<GameType | null>(null);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [joinGameId, setJoinGameId] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);

  const fetchGames = useCallback(async () => {
    if(!user) return;
    try {
      const games = await findAvailableGames();
      setAvailableGames(games.filter(g => g.playerIds[0] !== user.uid));
    } catch (error) {
      console.error("Failed to fetch available games:", error);
      toast({ title: "Error", description: "Could not fetch games list."});
    }
  }, [user, toast]);


  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchGames]);
  
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
        // Find the correct game type from the game object to redirect.
        const gameToJoin = availableGames.find(g => g.id === gameId) ?? { gameType: 'duel' };
        router.push(`/${gameToJoin.gameType}/${gameId}`);
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

  const handleJoinWithId = (e: FormEvent) => {
      e.preventDefault();
      if (!joinGameId.trim() || !user) return;
      setIsJoining(joinGameId);
      // We don't know the gameType from just the ID, so we need to fetch it first
      // However, for simplicity, we will assume 'duel' and let the page redirect if it's wrong
      // A better implementation would fetch the game doc first.
      // For now, let's just attempt to join and navigate. Firestore rules would be the guard.
      joinGame(joinGameId, user).then(() => {
          // This is a simplification. We don't know the game type from the ID alone.
          // We will push to duel and let the logic inside that page handle it.
          // A more robust solution would involve fetching the game doc from Firestore first.
          router.push(`/duel/${joinGameId}`);
      }).catch(error => {
          console.error("Failed to join game with ID:", error);
          toast({
              title: "Failed to Join",
              description: "Could not join game. Check the ID and make sure it's available.",
              variant: "destructive"
          });
          setIsJoining(null);
      })
  }

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
      
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <Card>
            <CardHeader>
            <CardTitle>{t('findMatch')}</CardTitle>
            <CardDescription>{t('findMatchDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-6">
            <GameCard gameType="duel" icon={Swords} />
            <GameCard gameType="janken" icon={Scissors} disabled />
            <GameCard gameType="poker" icon={Layers} disabled />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Join with Game ID</CardTitle>
                <CardDescription>Enter an ID to join a friend's game.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleJoinWithId} className="flex items-end gap-2">
                    <div className="flex-grow">
                        <Label htmlFor="game-id-input">{t('gameId')}</Label>
                        <Input
                            id="game-id-input"
                            placeholder="Enter Game ID..."
                            value={joinGameId}
                            onChange={(e) => setJoinGameId(e.target.value)}
                            disabled={!!isJoining}
                        />
                    </div>
                    <Button type="submit" disabled={!joinGameId.trim() || !!isJoining}>
                        {isJoining && isJoining === joinGameId ? <Loader2 className="h-4 w-4 animate-spin"/> : <LogIn className="h-4 w-4" />}
                        <span className="ml-2 hidden sm:inline">{t('joinGame')}</span>
                    </Button>
                </form>
            </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle>Waiting Games</CardTitle>
                <CardDescription>{t('orJoinWaitingGame')}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchGames}><RefreshCw className="h-5 w-5"/></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            {availableGames.length > 0 ? (
                availableGames.map(game => {
                    const host = game.players[game.playerIds[0]];
                    if (!host) return null;
                    return (
                        <div key={game.id} className="flex items-center justify-between p-4 rounded-lg border">
                            <div className="flex items-center gap-4">
                                <Avatar>
                                    <AvatarImage src={host.photoURL ?? undefined}/>
                                    <AvatarFallback>{host.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold">{host.displayName}</p>
                                    <p className="text-sm text-muted-foreground">{t(`${game.gameType}Title`)}</p>
                                </div>
                            </div>
                            <Button
                                onClick={() => handleJoinGame(game.id, game.gameType)}
                                disabled={!!isJoining}
                            >
                                {isJoining === game.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                {t('joinGame')}
                            </Button>
                        </div>
                    );
                })
            ) : (
                <p className="text-center text-muted-foreground">{t('noGamesAvailable')}</p>
            )}
        </CardContent>
      </Card>

    </div>
  );
}
