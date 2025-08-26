"use client";

import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
// import { createGame, findAvailableGames, joinGame, type Game } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Swords, Scissors, Layers, RefreshCw } from 'lucide-react';
import type { GameType } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { GameContext } from '@/contexts/game-context';
import type { Game } from '@/lib/firestore';

export default function OnlineLobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslation();
  const { language } = useContext(GameContext);

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGames = async () => {
    setLoading(true);
    // For now, we only support Duel
    // const availableGames = await findAvailableGames('duel');
    const availableGames: Game[] = []; // Disabled
    setGames(availableGames);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchGames();
  }, [user, router]);
  
  const handleCreateGame = async (gameType: GameType) => {
    if (!user) return;
    // try {
    //   const gameId = await createGame(user, gameType);
    //   router.push(`/${gameType}/${gameId}`);
    // } catch (error) {
    //   console.error("Failed to create game:", error);
    // }
  };

  const handleJoinGame = async (gameId: string, gameType: GameType) => {
    if (!user) return;
    // try {
    //     await joinGame(gameId, user);
    //     router.push(`/${gameType}/${gameId}`);
    // } catch (error) {
    //     console.error("Failed to join game:", error);
    // }
  };

  const GameCard = ({ gameType, icon: Icon }: { gameType: GameType; icon: React.ElementType }) => (
    <Card className="text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <Icon className="w-12 h-12 text-primary" />
        </div>
        <CardTitle>{t(`${gameType}Title`)}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => handleCreateGame(gameType)} disabled>{t('createGame')}</Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto">
      <h1 className="text-4xl font-bold text-center mb-8">{t('onlineLobby')}</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('createGame')}</CardTitle>
          <CardDescription>Online play is currently disabled. Please play with AI.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <GameCard gameType="duel" icon={Swords} />
          <Card className="text-center bg-muted/50">
            <CardHeader><div className="flex justify-center mb-4"><Scissors className="w-12 h-12 text-muted-foreground" /></div><CardTitle className="text-muted-foreground">{t('jankenTitle')}</CardTitle></CardHeader>
            <CardContent><Button disabled>Coming Soon</Button></CardContent>
          </Card>
          <Card className="text-center bg-muted/50">
            <CardHeader><div className="flex justify-center mb-4"><Layers className="w-12 h-12 text-muted-foreground" /></div><CardTitle className="text-muted-foreground">{t('pokerTitle')}</CardTitle></CardHeader>
            <CardContent><Button disabled>Coming Soon</Button></CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
                <CardTitle>Join a Game</CardTitle>
                <CardDescription>Join an existing game created by another player.</CardDescription>
            </div>
            <Button onClick={fetchGames} variant="ghost" size="icon" disabled={loading}>
                <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading games...</p>
          ) : games.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('noGamesAvailable')}</p>
          ) : (
            games.map((game) => (
              <div key={game.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={Object.values(game.players)[0]?.photoURL} />
                    <AvatarFallback>{Object.values(game.players)[0]?.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold">{t(`${game.gameType}Title`)}</p>
                    <p className="text-sm text-muted-foreground">
                        {t('vs')} {Object.values(game.players)[0]?.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(game.createdAt.toDate(), { addSuffix: true, locale: language === 'ja' ? ja : undefined })}
                    </p>
                  </div>
                </div>
                <Button onClick={() => handleJoinGame(game.id, game.gameType)}>
                  {t('joinGame')}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
