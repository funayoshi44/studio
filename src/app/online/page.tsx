
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
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isMatching, setIsMatching] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [matchingGameType, setMatchingGameType] = useState<GameType | null>(null);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [joinGameId, setJoinGameId] = useState('');
  
  const fetchGames = useCallback(async () => {
    if(!user) return;
    try {
      const games = await findAvailableGames();
      // Filter out games the user is already in
      const filteredGames = games.filter(g => !g.playerIds.includes(user.uid));
      setAvailableGames(filteredGames);
    } catch (error) {
      console.error("Failed to fetch available games:", error);
      toast({ title: "Error", description: "Could not fetch games list."});
    }
  }, [toast, user]);


  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchGames();
    const interval = setInterval(fetchGames, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [user, router, fetchGames]);
  
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

  const handleJoinWithId = async (e: FormEvent) => {
      e.preventDefault();
      if (!joinGameId.trim() || !user) return;
      setIsJoining(joinGameId);
      
      try {
        // This is a simplification. We don't know the game type from the ID alone.
        // `joinGame` will handle the transaction, but for redirection we need the type.
        // We'll try to find it in the available games list first.
        const allGames = await findAvailableGames(); // fetch all to find the game
        const game = allGames.find(g => g.id === joinGameId);
        
        await joinGame(joinGameId, user);

        if (game) {
            router.push(`/${game.gameType}/${joinGameId}`);
        } else {
            // If not in the public list, it might be a private game.
            // We have to assume a game type or fetch the doc.
            // For simplicity, we'll try to redirect and let the page handle it.
            // This is not ideal. A better `joinGame` would return the game data.
            router.push(`/duel/${joinGameId}`); // Fallback to a default
        }
      } catch (error) {
          console.error("Failed to join game with ID:", error);
          toast({
              title: "Failed to Join",
              description: "Could not join game. Check the ID and make sure it's available.",
              variant: "destructive"
          });
          setIsJoining(null);
      }
  }

  const matchmakingGames: { name: GameType; icon: React.ElementType, disabled?: boolean }[] = [
    { name: 'duel', icon: Swords },
    { name: 'janken', icon: Scissors },
    { name: 'poker', icon: Layers },
  ];

  return (
    <div className="container mx-auto">
      <h1 className="text-4xl font-bold text-center mb-8">{t('onlineLobby')}</h1>
      
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <Card>
            <CardHeader>
                <CardTitle>{t('findMatch')}</CardTitle>
                <CardDescription>{t('findMatchDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {matchmakingGames.map((game) => (
                    <div key={game.name} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                         <div className="flex items-center gap-4">
                            <game.icon className="w-8 h-8 text-primary" />
                            <span className="font-bold text-lg">{t(`${game.name}Title`)}</span>
                        </div>
                        {isMatching && matchingGameType === game.name ? (
                            <div className="flex items-center gap-2 px-4">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-muted-foreground">{t('autoMatching')}</span>
                            </div>
                        ) : (
                             <Button onClick={() => handleMatchmaking(game.name)} disabled={isMatching || game.disabled}>
                                {game.disabled ? t('comingSoon') : t('autoMatch')}
                            </Button>
                        )}
                    </div>
                ))}
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
