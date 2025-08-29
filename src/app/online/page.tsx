
"use client";

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { findAndJoinGame, type Game, subscribeToAvailableGames, joinGame } from '@/lib/firestore';
import { findAndJoinRTDBGame } from '@/lib/rtdb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Swords, Scissors, Layers, Loader2, RefreshCw, LogIn, Zap, Database, Construction } from 'lucide-react';
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
  
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Set up a real-time listener for available games
    const unsubscribe = subscribeToAvailableGames((games) => {
        const filteredGames = games.filter(g => !g.playerIds.includes(user.uid));
        setAvailableGames(filteredGames);
    });

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, [user, router]);
  
  const handleMatchmaking = async (gameType: GameType, dbType: 'firestore' | 'rtdb') => {
    if (!user || isMatching) return;

    setIsMatching(true);
    setMatchingGameType(gameType);

    try {
      let gameId: string;
      let path: string;

      if (dbType === 'rtdb') {
        gameId = await findAndJoinRTDBGame(user, gameType);
        path = gameType === 'janken' ? `/janken-rtdb/${gameId}` : `/${gameType}/${gameId}`;
      } else {
        gameId = await findAndJoinGame(user, gameType);
        path = gameType === 'duel' ? `/${gameType}-legacy/${gameId}` : `/${gameType}/${gameId}`;
      }
      
      router.push(path);

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
        const path = gameType === 'duel' ? `/${gameType}-legacy/${gameId}` : `/${gameType}/${gameId}`;
        router.push(path);
    } catch (error) {
        console.error("Failed to join game:", error);
        toast({
            title: "Error",
            description: "Failed to join the game. It might be full or no longer available.",
            variant: "destructive"
        });
        setIsJoining(null);
    }
  };

  const handleJoinWithId = async (e: FormEvent) => {
      e.preventDefault();
      if (!joinGameId.trim() || !user) return;
      setIsJoining(joinGameId);
      
      try {
        const id = joinGameId.trim();
        if (id.startsWith('game_')) { // RTDB game ID convention
            const gameType = id.includes('janken') ? 'janken' : 'duel'; // A simple guess
            const path = gameType === 'janken' ? `/janken-rtdb/${id}` : `/duel/${id}`;
            router.push(path);
            return;
        }
        
        // Assume Firestore otherwise
        const allGames = await findAvailableGames(); // fetch all to find the game
        const game = allGames.find(g => g.id === id);
        
        if (game) {
            await handleJoinGame(game.id, game.gameType);
        } else {
             toast({ title: "Game not found", description: "Could not find a waiting game with that ID in Firestore.", variant: 'destructive'})
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
  
  const matchmakingGames: { name: GameType; icon: React.ElementType, rtdbEnabled: boolean }[] = [
    { name: 'duel', icon: Swords, rtdbEnabled: true },
    { name: 'janken', icon: Scissors, rtdbEnabled: true },
    { name: 'poker', icon: Layers, rtdbEnabled: false },
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
                    <div key={game.name} className="p-3 rounded-lg border bg-background space-y-3">
                         <div className="flex items-center gap-4">
                            <game.icon className="w-8 h-8 text-primary" />
                            <span className="font-bold text-lg">{t(`${game.name}Title` as any)}</span>
                        </div>
                        {isMatching && matchingGameType === game.name ? (
                             <div className="flex items-center justify-center gap-2 px-4 py-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-muted-foreground">{t('autoMatching')}</span>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button onClick={() => handleMatchmaking(game.name, 'firestore')} disabled={isMatching}>
                                    <Database className="mr-2"/> 従来方式
                                </Button>
                                {game.rtdbEnabled ? (
                                    <Button onClick={() => handleMatchmaking(game.name, 'rtdb')} disabled={isMatching}>
                                        <Zap className="mr-2" /> 高速方式 (RTDB)
                                    </Button>
                                ) : (
                                    <Button disabled={true} variant="secondary">
                                        <Construction className="mr-2" /> 高速方式 (準備中)
                                    </Button>
                                )}
                            </div>
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
                <CardTitle>Waiting Games (Firestore)</CardTitle>
                <CardDescription>{t('orJoinWaitingGame')}</CardDescription>
            </div>
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
                                    <p className="text-sm text-muted-foreground">{t(`${game.gameType}Title` as any)}</p>
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
                <p className="text-center text-muted-foreground py-10">{t('noGamesAvailable')}</p>
            )}
        </CardContent>
      </Card>

    </div>
  );
}
