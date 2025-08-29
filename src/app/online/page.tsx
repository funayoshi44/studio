
"use client";

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { findAndJoinGame, type Game, subscribeToAvailableGames, joinGame } from '@/lib/firestore';
import { findAndJoinRTDBGame, RTDBGame } from '@/lib/rtdb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Swords, Scissors, Layers, Loader2, RefreshCw, LogIn, Zap, Database, Construction, UserCheck } from 'lucide-react';
import type { GameType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { onValue, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export default function OnlineLobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isMatching, setIsMatching] = useState(false);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [matchingGameType, setMatchingGameType] = useState<GameType | null>(null);
  const [availableRTDBGames, setAvailableRTDBGames] = useState<RTDBGame[]>([]);
  
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // RTDB listener
    const rtdbGamesRef = ref(rtdb, 'lobbies');
    const unsubscribeRTDB = onValue(rtdbGamesRef, (snapshot) => {
        const allLobbies = snapshot.val();
        const waitingGames: RTDBGame[] = [];
        if (allLobbies) {
            Object.keys(allLobbies).forEach(gameType => {
                const gamesInType = allLobbies[gameType];
                Object.keys(gamesInType).forEach(gameId => {
                    const game = gamesInType[gameId];
                    if (game.status === 'waiting' && game.playerIds && !game.playerIds.includes(user.uid)) {
                        waitingGames.push({ id: gameId, ...game });
                    }
                });
            });
        }
        setAvailableRTDBGames(waitingGames);
    });

    return () => {
        unsubscribeRTDB();
    };
  }, [user, router]);
  
  const handleMatchmaking = async (gameType: GameType) => {
    if (!user || isMatching) return;

    setIsMatching(true);
    setMatchingGameType(gameType);

    try {
      const gameId = await findAndJoinRTDBGame(user, gameType);
      const path = gameType === 'janken' ? `/janken-rtdb/${gameId}` : `/duel/${gameId}`;
      
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

  const handleJoinGame = async (game: RTDBGame) => {
    if (!user) return;
    setIsJoining(game.id);
    try {
        const path = game.gameType === 'janken' ? `/janken-rtdb/${game.id}` : `/duel/${game.id}`;
        await findAndJoinRTDBGame(user, game.gameType); // This will handle joining logic
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
                                {game.rtdbEnabled ? (
                                    <Button onClick={() => handleMatchmaking(game.name)} disabled={isMatching}>
                                        <Zap className="mr-2" /> {t('autoMatch')}
                                    </Button>
                                ) : (
                                    <Button disabled={true} variant="secondary">
                                        <Construction className="mr-2" /> {t('comingSoon')}
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
                <CardTitle>Waiting Games</CardTitle>
                <CardDescription>{t('orJoinWaitingGame')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                 {availableRTDBGames.length > 0 ? (
                    availableRTDBGames.map(game => {
                        const host = game.players[game.playerIds[0]];
                        if (!host) return null;
                        return (
                            <div key={game.id} className="flex items-center justify-between p-4 rounded-lg border">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Avatar>
                                            <AvatarImage src={host.photoURL ?? undefined}/>
                                            <AvatarFallback>{host.displayName?.[0]}</AvatarFallback>
                                        </Avatar>
                                        {host.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />}
                                    </div>
                                    <div>
                                        <p className="font-bold">{host.displayName}</p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                           <Zap className="w-4 h-4 text-yellow-500" />
                                           <span>{t(`${game.gameType}Title` as any)}</span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleJoinGame(game)}
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

    </div>
  );
}
