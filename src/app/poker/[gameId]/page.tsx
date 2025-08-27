
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { subscribeToGame, submitMove, updateGameState, type Game, leaveGame, type CardData } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Copy, Flag, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PokerCard as GameCard } from '@/components/ui/poker-card';
import { evaluatePokerHand, type HandRank } from '@/lib/game-logic/poker';
import { cn } from '@/lib/utils';

type PokerGameState = {
  phase: 'waiting' | 'dealing' | 'exchanging' | 'showdown' | 'finished';
  deck: CardData[];
  playerHands: { [uid: string]: CardData[] };
  selectedCards: { [uid: string]: number[] }; // Indices of cards to exchange
  exchangeCounts: { [uid: string]: number };
  playerRanks: { [uid: string]: HandRank };
  turnOrder: string[];
  currentTurnIndex: number;
  winners: string[] | 'draw' | null;
  resultText: string;
};

export default function OnlinePokerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { toast } = useToast();
  const t = useTranslation();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [localSelected, setLocalSelected] = useState<number[]>([]);

  const gameState = game?.gameState as PokerGameState | undefined;
  const isMyTurn = user && gameState && gameState.turnOrder[gameState.currentTurnIndex] === user.uid;

  useEffect(() => {
    if (!gameId || !user) return;
    const unsubscribe = subscribeToGame(gameId, (gameData) => {
      if (gameData) {
        if (!gameData.playerIds.includes(user.uid)) {
            toast({ title: "Access Denied", description: "You are not a player in this game.", variant: 'destructive' });
            router.push('/online');
            return;
        }
        if (game?.status === 'in-progress' && gameData.status === 'finished') {
            toast({ title: t('opponentDisconnectedTitle'), description: t('opponentDisconnectedBody') });
        }
        setGame(gameData);
      } else {
        toast({ title: "Error", description: "Game not found.", variant: 'destructive' });
        router.push('/online');
      }
    });
    return () => unsubscribe();
  }, [gameId, user, router, toast, game?.status, t]);

  const handleSelectCard = (index: number) => {
    if (gameState?.phase !== 'exchanging' || !isMyTurn) return;
    setLocalSelected(prev => {
      const selected = [...prev];
      if (selected.includes(index)) {
        return selected.filter(i => i !== index);
      }
      return [...selected, index];
    });
  };
  
  const handleExchange = async () => {
    if (!user || !gameState || !isMyTurn || gameState.phase !== 'exchanging') return;
    setLoading(true);
    try {
      await submitMove(gameId, user.uid, { action: 'exchange', indices: localSelected });
      setLocalSelected([]);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to exchange cards", variant: "destructive" });
    }
    setLoading(false);
  };
  
  const handleShowdown = async () => {
     if (!user || !gameState || !isMyTurn || gameState.phase !== 'exchanging') return;
     setLoading(true);
     try {
       await submitMove(gameId, user.uid, { action: 'showdown' });
     } catch (error) {
       console.error(error);
       toast({ title: "Error", description: "Failed to proceed to showdown", variant: "destructive" });
     }
     setLoading(false);
  };

  const handleForfeit = async () => {
    if (user && gameId) {
        await leaveGame(gameId, user.uid);
        router.push('/online');
    }
  };

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId);
    toast({ title: t('gameIdCopied') });
  };
  
  const handleNextRound = async () => {
    if (!user || game?.playerIds[0] !== user.uid) return;
    await updateGameState(gameId, { ...game.gameState, phase: 'dealing', winners: null, resultText: '' });
  };

  const PlayerDisplay = ({ uid }: { uid: string }) => {
    if (!game || !gameState || !user) return null;
    const player = game.players[uid];
    const hand = gameState.playerHands[uid];
    const handRank = gameState.playerRanks?.[uid];
    const isRevealed = gameState.phase === 'showdown' || gameState.phase === 'finished';
    const isSelf = uid === user.uid;

    return (
        <div className={cn("p-4 rounded-lg border-2", isMyTurn ? "border-primary shadow-lg" : "border-transparent")}>
            <div className="flex items-center gap-2 mb-3">
                <Avatar>
                    <AvatarImage src={player?.photoURL ?? undefined} />
                    <AvatarFallback>{player?.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <span className="font-bold">{player?.displayName}</span>
                {gameState.phase === 'exchanging' && gameState.exchangeCounts[uid] > 0 && <span className="text-xs text-muted-foreground">({gameState.exchangeCounts[uid]} exchanges)</span>}
            </div>
            <div className="flex justify-center flex-wrap gap-1">
                {hand.map((card, index) => (
                    <div key={card.id || index} onClick={() => isSelf && handleSelectCard(index)} className={cn(localSelected.includes(index) && 'transform -translate-y-2', "cursor-pointer")}>
                        <GameCard card={card} revealed={isSelf || isRevealed} />
                    </div>
                ))}
            </div>
             {isRevealed && handRank && <p className="mt-2 text-center font-semibold">{t(handRank.name as any)}</p>}
        </div>
    );
  };


  if (!user || !game || !gameState) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game...</div>;
  }

  if (game.status === 'waiting') {
    return (
        <div className="text-center py-10">
            <h2 className="text-2xl font-bold mb-4">{t('waitingForPlayer')}</h2>
            <p className="mb-2">Game needs 2-4 players to start.</p>
            <p className="mb-4 text-muted-foreground">{t('shareGameId')}</p>
            <div className="flex items-center justify-center gap-2 mb-6">
                <code className="p-2 bg-muted rounded-md">{gameId}</code>
                <Button onClick={handleCopyGameId} size="icon" variant="ghost"><Copy className="h-4 w-4"/></Button>
            </div>
            <p>Current Players: {game.playerIds.length}/4</p>
            <Loader2 className="animate-spin h-8 w-8 mx-auto my-8" />
        </div>
    );
  }

  return (
    <div className="container mx-auto">
       <div className="flex justify-between items-center mb-4">
          <h2 className="text-3xl font-bold">{t('pokerTitle')} - Online</h2>
          <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Flag className="mr-2 h-4 w-4" />{t('forfeit')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>{t('forfeitConfirmationTitle')}</AlertDialogTitle><AlertDialogDescription>{t('forfeitConfirmationBody')}</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogAction onClick={handleForfeit}>{t('forfeit')}</AlertDialogAction><AlertDialogCancel>{t('cancel')}</AlertDialogCancel></AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        </div>
      
      {/* Game Info Bar */}
      <Card className="mb-4 p-3 text-center">
          {gameState.phase === 'exchanging' && isMyTurn && <p className="font-bold text-primary animate-pulse">{t('yourTurn')}</p>}
          {gameState.phase === 'exchanging' && !isMyTurn && <p className="text-muted-foreground">{t('waitingForOpponentMove')}</p>}
          {gameState.phase === 'showdown' && <p className="font-bold">{gameState.resultText}</p>}
          {gameState.phase === 'finished' && <p className="text-2xl font-bold">{gameState.resultText}</p>}
      </Card>
      
      {/* Player Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {game.playerIds.map(uid => <PlayerDisplay key={uid} uid={uid} />)}
      </div>

      {/* Action Buttons */}
      {gameState.phase === 'exchanging' && isMyTurn && (
        <div className="mt-6 flex justify-center gap-4">
          <Button onClick={handleExchange} disabled={loading || gameState.exchangeCounts[user.uid] >= 2 || localSelected.length === 0} size="lg">Exchange ({localSelected.length})</Button>
          <Button onClick={handleShowdown} disabled={loading} size="lg" variant="secondary">Showdown</Button>
        </div>
      )}
      
       {gameState.phase === 'finished' && (
         <div className="text-center mt-6">
            {user.uid === game.playerIds[0] ? (
              <Button onClick={handleNextRound} size="lg">{t('playAgain')}</Button>
            ) : (
               <p className="text-muted-foreground">Waiting for host to start the next round...</p>
            )}
            <Link href="/online" className="ml-4"><Button variant="outline" size="lg">{t('backToMenu')}</Button></Link>
         </div>
       )}

    </div>
  );
}
