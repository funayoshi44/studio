
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { subscribeToGame, submitMove, updateGameState, leaveGame, awardPoints, type Game } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Copy, Flag, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PokerCard as GameCard } from '@/components/ui/poker-card';
import { useVictorySound } from '@/hooks/use-victory-sound';
import { VictoryAnimation } from '@/components/victory-animation';
import type { CardData } from '@/lib/types';


type DuelGameState = {
  currentRound: number;
  playerHands: { [uid: string]: CardData[] };
  scores: { [uid: string]: number };
  kyuso: { [uid: string]: number };
  only: { [uid: string]: number };
  moves: { [uid: string]: CardData | null };
  lastMoveBy: string | null;
  history: { [round: number]: { [uid: string]: number } };
  roundWinner: string | 'draw' | null;
  roundResultText: string;
  roundResultDetail: string;
};

const TOTAL_ROUNDS = 13;

export default function LegacyOnlineDuelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { toast } = useToast();
  const playVictorySound = useVictorySound();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);

  const { t } = useTranslation();

  const gameState = game?.gameState as DuelGameState | undefined;
  const opponentId = game && user ? game.playerIds.find(p => p !== user.uid) : null;
  const isHost = useMemo(() => user && game && game.playerIds.length > 0 && game.playerIds[0] === user.uid, [user, game]);

  // Subscribe to game updates
  useEffect(() => {
    if (!gameId || !user) return;
    const unsubscribe = subscribeToGame(gameId, (gameData) => {
      if (gameData) {
        if (!gameData.playerIds.includes(user.uid)) {
          toast({ title: "Access Denied", description: "You are not in this game.", variant: 'destructive' });
          router.push('/online');
          return;
        }

        // Opponent disconnected check
        if (game?.status === 'in-progress' && gameData.status === 'finished' && gameData.winner === user.uid) {
            toast({ title: t('opponentDisconnectedTitle'), description: t('opponentDisconnectedBody') });
        }
        
        // Play victory sound on win
        if(gameData.gameState.roundWinner === user.uid && game?.gameState.roundWinner !== user.uid) {
            playVictorySound();
        }
        if(gameData.winner === user.uid && game?.winner !== user.uid) {
            playVictorySound();
        }
        
        setGame(gameData);
      } else {
        toast({ title: "Error", description: "Game not found.", variant: 'destructive' });
        router.push('/online');
      }
    });
    return () => unsubscribe();
  }, [gameId, user, router, toast, t, game?.status, game?.winner, game?.gameState.roundWinner, playVictorySound]);

  // Evaluate round when both players have moved
  useEffect(() => {
    if (!gameState || !user || !opponentId) return;

    // Only host evaluates to prevent race conditions
    if (user.uid !== game?.playerIds[0]) return;
    
    const myMove = gameState.moves?.[user.uid];
    const opponentMove = gameState.moves?.[opponentId];

    if (myMove && opponentMove && gameState.roundWinner === null) {
      evaluateRound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.moves, user?.uid, opponentId]);
  
  const handleSelectCard = async (card: CardData) => {
    if (loading || !user || !gameState) return;
    if (gameState.moves?.[user.uid]) return; // Already played

    setLoading(true);
    try {
      await submitMove(gameId, user.uid, card);
    } catch (error) {
      console.error("Failed to submit move:", error);
      toast({ title: "Error", description: "Failed to submit move.", variant: 'destructive' });
    }
    setLoading(false);
  };
  
  const evaluateRound = () => {
    if (!user || !opponentId || !gameState || !game) return;

    let winnerId: string | 'draw' = 'draw';
    let resultText = '';
    let resultDetail = '';
    let winType = '';
    
    let newScores = { ...gameState.scores };
    let newKyuso = { ...gameState.kyuso };
    let newOnly = { ...gameState.only };
    let newPlayerHands = { ...gameState.playerHands };

    const myCard = gameState.moves[user.uid];
    const opponentCard = gameState.moves[opponentId];
    
    if (!myCard || !opponentCard) return;

    const myCardNumber = myCard.number;
    const opponentCardNumber = opponentCard.number;

    if (myCardNumber === 1 && opponentCardNumber === 13) { winnerId = user.uid; winType = 'only'; }
    else if (opponentCardNumber === 1 && myCardNumber === 13) { winnerId = opponentId; winType = 'only'; }
    else if (myCardNumber === opponentCardNumber - 1) { winnerId = user.uid; winType = 'kyuso'; }
    else if (opponentCardNumber === myCardNumber - 1) { winnerId = opponentId; winType = 'kyuso'; }
    else if (myCardNumber > opponentCardNumber) { winnerId = user.uid; }
    else if (opponentCardNumber > myCardNumber) { winnerId = opponentId; }


    if (winnerId !== 'draw') {
        newScores[winnerId]++;
        if (winType === 'only') {
            newOnly[winnerId]++;
            resultDetail = t('duelResultOnlyOne');
        } else if (winType === 'kyuso') {
            newKyuso[winnerId]++;
            resultDetail = t('duelResultKyuso');
        }
    }
    
    if (winnerId === 'draw') {
        resultText = t('draw');
    } else {
        const winnerName = game.players[winnerId]?.displayName ?? 'Player';
        resultText = `${winnerName} ${t('wins')}!`;
    }

    if(!resultDetail) resultDetail = `${game.players[user.uid]?.displayName ?? 'You'}: ${myCardNumber} vs ${game.players[opponentId]?.displayName ?? 'Opponent'}: ${opponentCardNumber}`;

    // Update hands (remove used card)
    newPlayerHands[user.uid] = newPlayerHands[user.uid].filter(c => c.id !== myCard.id);
    newPlayerHands[opponentId] = newPlayerHands[opponentId].filter(c => c.id !== opponentCard.id);
    
    const newHistory = { ...gameState.history, [gameState.currentRound]: { [user.uid]: myCardNumber, [opponentId]: opponentCardNumber }};

    const evaluatedState: DuelGameState = {
        ...gameState,
        scores: newScores,
        kyuso: newKyuso,
        only: newOnly,
        playerHands: newPlayerHands,
        roundWinner: winnerId,
        resultText: resultText,
        resultDetail: resultDetail,
        history: newHistory,
    };
    
    updateGameState(gameId, evaluatedState).then(() => {
        setTimeout(() => {
            checkGameEnd(evaluatedState);
        }, 2000);
    });
  };
  
  const checkGameEnd = async (currentState: DuelGameState) => {
     if(!user || !opponentId || !isHost || !game) return;

      const { scores, kyuso, only, currentRound } = currentState;
      const p1Id = game.playerIds[0];
      const p2Id = game.playerIds[1];
      let ended = false;
      let finalWinnerId: string | string[] | 'draw' | null = null;
      
      if (only[p1Id] > 0) { ended = true; finalWinnerId = p1Id; }
      else if (only[p2Id] > 0) { ended = true; finalWinnerId = p2Id; }
      else if (kyuso[p1Id] >= 3) { ended = true; finalWinnerId = p1Id; }
      else if (kyuso[p2Id] >= 3) { ended = true; finalWinnerId = p2Id; }
      else if (currentRound >= TOTAL_ROUNDS) {
          ended = true;
          if (scores[p1Id] > scores[p2Id]) finalWinnerId = p1Id;
          else if (scores[p2Id] > scores[p1Id]) finalWinnerId = p2Id;
          else finalWinnerId = 'draw';
      }

      if (ended) {
          if (finalWinnerId !== 'draw' && finalWinnerId !== null) {
              await awardPoints(Array.isArray(finalWinnerId) ? finalWinnerId[0] : finalWinnerId, 2); // Award 2 points for a win
          }
          await updateGameState(gameId, { status: 'finished', winner: finalWinnerId });
      } else {
          // Reset for next round
          await updateGameState(gameId, {
            ...currentState,
            currentRound: currentState.currentRound + 1,
            moves: { [p1Id]: null, [p2Id]: null },
            roundWinner: null,
            roundResultText: '',
            roundResultDetail: '',
            lastMoveBy: null,
          });
      }
  };

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId);
    toast({ title: t('gameIdCopied') });
  };
  
  const handleForfeit = async () => {
    if (user && gameId) {
        await leaveGame(gameId, user.uid);
        router.push('/online');
    }
  };

  if (!user || !game || !gameState) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game...</div>;
  }
  
  if (game.status === 'waiting') {
    return (
        <div className="text-center py-10">
            <h2 className="text-2xl font-bold mb-4">{t('waitingForPlayer')}</h2>
            <p className="mb-4 text-muted-foreground">{t('shareGameId')}</p>
            <div className="flex items-center justify-center gap-2 mb-6">
                <code className="p-2 bg-muted rounded-md">{gameId}</code>
                <Button onClick={handleCopyGameId} size="icon" variant="ghost"><Copy className="h-4 w-4"/></Button>
            </div>
            <p className="mb-4">{t('orShareUrl')}</p>
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-8"></div>
        </div>
    );
  }

  const PlayerInfo = ({ uid }: { uid: string }) => {
    const player = game?.players?.[uid];
    if (!player) return null;
    return (
        <div className="flex flex-col items-center gap-2">
            <Avatar className="w-16 h-16">
                <AvatarImage src={player.photoURL ?? undefined} />
                <AvatarFallback className="text-2xl">{player.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <p className="font-bold text-lg">{uid === user.uid ? t('you') : player.displayName}</p>
        </div>
    );
  }
  
  const ScoreDisplay = () => {
    if (!game || !gameState) return null;
    const p1Id = game.playerIds[0];
    const p2Id = game.playerIds[1];
    if (!game.players[p1Id] || !game.players[p2Id]) return null;

    return (
      <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-8 text-base mb-4">
          <>
            <Card className="p-3 md:p-4 bg-blue-100 dark:bg-blue-900/50">
              <p className="font-bold">{game.players[p1Id].displayName}: {gameState.scores?.[p1Id] ?? 0} {t('wins')}</p>
              <div className="text-sm opacity-80">
                <span>{t('kyuso')}: {gameState.kyuso?.[p1Id] ?? 0} | </span>
                <span>{t('onlyOne')}: {gameState.only?.[p1Id] ?? 0}</span>
              </div>
            </Card>
             <Card className="p-3 md:p-4 bg-red-100 dark:bg-red-900/50">
                <p className="font-bold">{game.players[p2Id].displayName}: {gameState.scores?.[p2Id] ?? 0} {t('wins')}</p>
                <div className="text-sm opacity-80">
                    <span>{t('kyuso')}: {gameState.kyuso?.[p2Id] ?? 0} | </span>
                    <span>{t('onlyOne')}: {gameState.only?.[p2Id] ?? 0}</span>
                </div>
            </Card>
          </>
      </div>
    );
  };

  const myHand = gameState.playerHands?.[user.uid] ?? [];
  const myMove = gameState.moves?.[user.uid];
  const opponentMove = opponentId ? gameState.moves?.[opponentId] : null;

  return (
    <div className="text-center">
      {gameState.roundWinner === user.uid && <VictoryAnimation />}
      {game.winner === user.uid && <VictoryAnimation />}

      <div className="flex justify-between items-center mb-2">
        <div className="w-1/3"></div>
        <div className="w-1/3 text-center">
            <h2 className="text-3xl font-bold">{t('duelTitle')} - Online</h2>
        </div>
        <div className="w-1/3 flex justify-end">
             {game.status === 'in-progress' && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                            <Flag className="mr-2 h-4 w-4" />
                            {t('forfeit')}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>{t('forfeitConfirmationTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                           {t('forfeitConfirmationBody')}
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogAction onClick={handleForfeit}>{t('forfeit')}</AlertDialogAction>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
      </div>

      <div className="mb-4 text-muted-foreground">
        <span>{t('round')} {gameState.currentRound > TOTAL_ROUNDS ? TOTAL_ROUNDS : gameState.currentRound} / {TOTAL_ROUNDS}</span>
      </div>
      <ScoreDisplay />
      
      {game.status !== 'finished' && (
        <>
          {!gameState.roundWinner && (
            <div className="my-8">
                {myMove == null ? (
                    <>
                        <h3 className="text-xl font-bold mb-4">{t('selectCard')}</h3>
                        <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                            {myHand.sort((a,b) => a.number - b.number).map(card => (
                              <button key={card.id} onClick={() => handleSelectCard(card)} disabled={loading} className="transition-transform hover:scale-105">
                                  <GameCard card={card} revealed={true} />
                              </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-xl font-semibold text-muted-foreground animate-pulse">{t('waitingForOpponentMove')}</p>
                )}
            </div>
          )}

          {(myMove != null) && (
            <div className="my-8">
              <div className="flex justify-around items-center">
                <div className="text-center">
                  <PlayerInfo uid={user.uid} />
                  <div className="mt-2"><GameCard card={myMove} revealed={true}/></div>
                </div>
                <div className="text-2xl font-bold">VS</div>
                <div className="text-center">
                  {opponentId && <PlayerInfo uid={opponentId} />}
                  <div className="mt-2"><GameCard card={opponentMove} revealed={opponentMove !== null}/></div>
                </div>
              </div>
            </div>
          )}

          {gameState.roundWinner && (
            <div className="my-6">
              <p className="text-2xl font-bold mb-2">{gameState.roundResultText}</p>
              <p className="text-lg text-muted-foreground">{gameState.roundResultDetail}</p>
            </div>
          )}
        </>
      )}

      {game.status === 'finished' && (
        <div className="my-8">
            <p className="text-4xl font-bold mb-4">
                {game.winner === 'draw'
                    ? t('duelFinalResultDraw')
                    : game.winner ? `${game.players[game.winner as string]?.displayName ?? 'Player'} ${t('winsTheGame')}!` : "Game Over"}
            </p>
            <div className="space-x-4 mt-6">
                <Link href="/online" passHref>
                    <Button size="lg">{t('backToMenu')}</Button>
                </Link>
          </div>
        </div>
      )}

      <Card className="max-w-4xl mx-auto mt-12 text-left bg-card/50">
        <CardHeader><CardTitle>📖 {t('duelTitle')} Rules</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• {t('duelDescription')}</p>
          <p>• Higher number wins each round.</p>
          <p>• <strong>{t('kyuso')}:</strong> Win with a number exactly 1 smaller than the opponent's (e.g., 5 beats 6). 3 Kyuso wins result in an instant victory.</p>
          <p>• <strong>{t('onlyOne')}:</strong> 1 beats 13 for an instant victory.</p>
        </CardContent>
      </Card>
    </div>
  );
}
