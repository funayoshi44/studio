
"use client";

import { useState, useEffect, useContext } from 'react';
import { GameContext } from '@/contexts/game-context';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { Game, GameType, Difficulty, OnlineGameRecord } from '@/lib/types';
import { getUserGameHistory } from '@/lib/rtdb';
import { Loader2, Swords, Scissors, Layers, Trophy, AlertTriangle, MinusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { history: aiHistory, clearHistory } = useContext(GameContext);
  const { t, language } = useTranslation();
  const [onlineHistory, setOnlineHistory] = useState<OnlineGameRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    if (user) {
      setIsLoadingHistory(true);
      getUserGameHistory(user.uid)
        .then(games => {
          const processedHistory: OnlineGameRecord[] = games.map(game => {
            const opponentId = game.playerIds.find(id => id !== user.uid);
            const opponent = opponentId ? game.players[opponentId] : null;
            let result: 'win' | 'loss' | 'draw' = 'draw';
            if (game.winner === user.uid) result = 'win';
            else if (game.winner && game.winner !== 'draw') result = 'loss';
            
            return {
              id: game.id,
              gameType: game.gameType,
              opponent: opponent ? { uid: opponentId!, displayName: opponent.displayName!, photoURL: opponent.photoURL! } : { uid: 'unknown', displayName: 'Unknown Player', photoURL: '' },
              result: result,
              playedAt: new Date((game.createdAt as any)?.time || Date.now()),
            };
          });
          setOnlineHistory(processedHistory);
        })
        .catch(console.error)
        .finally(() => setIsLoadingHistory(false));
    } else if (!authLoading) {
      setIsLoadingHistory(false);
    }
  }, [user, authLoading]);

  const handleClearHistory = () => {
    if (window.confirm(t('clearHistoryConfirm'))) {
      clearHistory();
    }
  };

  const gameTypes: GameType[] = ['duel', 'janken', 'poker'];
  const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];
  
  const getGameIcon = (gameType: GameType) => {
    switch (gameType) {
        case 'duel': return <Swords className="w-4 h-4" />;
        case 'janken': return <Scissors className="w-4 h-4" />;
        case 'poker': return <Layers className="w-4 h-4" />;
        default: return null;
    }
  }

  const getResultBadge = (result: 'win' | 'loss' | 'draw') => {
    switch(result) {
        case 'win': return <Badge variant="default" className="bg-green-500 hover:bg-green-600"><Trophy className="w-3 h-3 mr-1"/> WIN</Badge>;
        case 'loss': return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1"/> LOSS</Badge>;
        case 'draw': return <Badge variant="secondary"><MinusCircle className="w-3 h-3 mr-1"/> DRAW</Badge>;
    }
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8">{t('historyTitle')}</h1>
      
      <div className="w-full max-w-4xl">
        <Tabs defaultValue="online">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="online">Online Matches</TabsTrigger>
                <TabsTrigger value="ai">AI Stats</TabsTrigger>
            </TabsList>
            <TabsContent value="online">
                <Card>
                    <CardHeader>
                        <CardTitle>Online Match History</CardTitle>
                        <CardDescription>Your recent online battles.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoadingHistory ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                        ) : onlineHistory.length > 0 ? (
                           onlineHistory.map(game => (
                            <Link key={game.id} href={`/profile/${game.opponent.uid}`} className="block">
                                <div className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <Avatar>
                                            <AvatarImage src={game.opponent.photoURL} />
                                            <AvatarFallback>{game.opponent.displayName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-bold">vs {game.opponent.displayName}</p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                {getGameIcon(game.gameType)}
                                                <span>{t(`${game.gameType}Title` as any)}</span>
                                                <span className="hidden sm:inline-block">• {format(game.playedAt, 'PPp', { locale: language === 'ja' ? ja : undefined })}</span>
                                            </p>
                                        </div>
                                    </div>
                                    {getResultBadge(game.result)}
                                </div>
                            </Link>
                           ))
                        ) : (
                            <p className="text-center text-muted-foreground py-10">No online match history found.</p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="ai">
                 <div className="space-y-6">
                    {gameTypes.map((gameType) => (
                    <Card key={gameType}>
                        <CardHeader>
                        <CardTitle>{t(`${gameType}Title` as any)}</CardTitle>
                        </CardHeader>
                        <CardContent>
                        <div className="grid md:grid-cols-3 gap-4">
                            {difficulties.map((difficulty) => {
                            const stats = aiHistory[gameType]?.[difficulty] ?? { wins: 0, losses: 0 };
                            const total = stats.wins + stats.losses;
                            const winRate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0.0';

                            return (
                                <Card key={difficulty} className="bg-background/50">
                                <CardHeader>
                                    <CardTitle className="capitalize">{t(difficulty)}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1 text-sm">
                                    <p>{t('wins')}: {stats.wins}</p>
                                    <p>{t('losses')}: {stats.losses}</p>
                                    <p>{t('winRate')}: {winRate}%</p>
                                </CardContent>
                                </Card>
                            );
                            })}
                        </div>
                        </CardContent>
                    </Card>
                    ))}
                </div>
                 <div className="mt-6 flex justify-center space-x-4">
                    <Button onClick={handleClearHistory} variant="destructive">
                    {t('clearHistory')}
                    </Button>
                    <Link href="/" passHref>
                    <Button variant="secondary">{t('backToMenu')}</Button>
                    </Link>
                </div>
            </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}
