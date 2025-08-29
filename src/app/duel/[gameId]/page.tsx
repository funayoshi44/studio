
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Copy, Flag, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PokerCard as GameCard } from '@/components/ui/poker-card';
import { useVictorySound } from '@/hooks/use-victory-sound';
import { VictoryAnimation } from '@/components/victory-animation';
import type { CardData } from '@/lib/types';
import { type RTDBGame, subscribeToRTDBGame, leaveRTDBGame, updateRTDBGameState, submitRTDBMove, setupPresence, teardownPresence, setPlayerOnlineStatus } from '@/lib/rtdb';
import { awardPoints } from '@/lib/firestore';

const TOTAL_ROUNDS = 13;

type DuelGameState = {
  currentRound: number;
  playerHands: { [uid: string]: CardData[] };
  scores: { [uid:string]: number };
  kyuso: { [uid:string]: number };
  only: { [uid:string]: number };
  moves: { [uid: string]: CardData | null };
  lastMoveBy: string | null;
  history: { [round: number]: { [uid: string]: CardData } };
  roundWinner: string | null; // UID of winner or 'draw'
  roundResultText: string;
  roundResultDetail: string;
};

export default function OnlineDuelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { toast } = useToast();
  const playVictorySound = useVictorySound();

  const { t } = useTranslation();
  const [game, setGame] = useState<RTDBGame | null>(null);
  const [loading, setLoading] = useState(false);

  const gameState = game?.gameState as DuelGameState | undefined;
  const opponentId = game && user ? game.playerIds.find(p => p !== user.uid) : null;
  const opponentInfo = opponentId ? game?.players[opponentId] : null;
  const isHost = user && game && game.playerIds[0] === user.uid;


  // Setup user presence in RTDB
  useEffect(() => {
    if (user) {
        setupPresence(user.uid);
    }
    return () => {
        teardownPresence();
    }
  }, [user]);

  // Subscribe to game updates from RTDB
  useEffect(() => {
    if (!gameId || !user) return;
    
    const unsubscribeGame = subscribeToRTDBGame('duel', gameId, (gameData) => {
      if (gameData) {
        if (!gameData.playerIds.includes(user.uid)) {
            toast({ title: "Access Denied", description: "You are not a player in this game.", variant: 'destructive' });
            router.push('/online');
            return;
        }

        // Check if opponent has disconnected
        if (game?.status === 'in-progress' && gameData.status === 'finished' && Array.isArray(gameData.winner) && gameData.winner.includes(user.uid)) {
            toast({ title: t('opponentDisconnectedTitle'), description: t('opponentDisconnectedBody') });
            setTimeout(() => router.push('/online'), 3000);
        }
        
        // Update my online status within the game
        setPlayerOnlineStatus('duel', gameId, user.uid, true);

        setGame(gameData);
      } else {
        toast({ title: "Error", description: "Game not found.", variant: 'destructive' });
        router.push('/online');
      }
    });

    return () => {
      unsubscribeGame();
       if (user) {
         setPlayerOnlineStatus('duel', gameId, user.uid, false);
       }
    };
  }, [gameId, user, router, toast, game?.status, t]);

  // Evaluate round when both players have moved
  useEffect(() => {
    if (!game || !gameState || !user || !opponentId) return;

    // Only the host evaluates the round to prevent duplicate updates
    if (!isHost) return;

    const playerMove = gameState.moves?.[user.uid];
    const opponentMove = gameState.moves?.[opponentId];

    if (playerMove != null && opponentMove != null && gameState.roundWinner === null) {
      evaluateRound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.gameState, game?.playerIds, user, opponentId, isHost]);

  // Play sound/animation on win
  useEffect(() => {
    if (user && game && gameState) {
        if (gameState.roundWinner === user.uid || (Array.isArray(game.winner) && game.winner.includes(user.uid))) {
            playVictorySound();
        }
    }
  }, [gameState?.roundWinner, game?.winner, user, playVictorySound]);
  
  const handleSelectCard = async (card: CardData) => {
    if (loading || !user || !game || !gameState) return;
    if (gameState.moves?.[user.uid]) return;

    setLoading(true);
    try {
      await submitRTDBMove('duel', gameId, user.uid, card);
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
    
    let newGameState = JSON.parse(JSON.stringify(gameState));

    const myCard = newGameState.moves[user.uid];
    const opponentCard = newGameState.moves[opponentId];
    
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
        newGameState.scores[winnerId]++;
        if (winType === 'only') {
            newGameState.only[winnerId]++;
            resultDetail = t('duelResultOnlyOne');
        } else if (winType === 'kyuso') {
            newGameState.kyuso[winnerId]++;
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

    const roundHistory = { [user.uid]: myCard, [opponentId]: opponentCard };
    newGameState.history[newGameState.currentRound] = roundHistory;
    newGameState.playerHands[user.uid] = newGameState.playerHands[user.uid].filter((c:CardData) => c.id !== myCard.id);
    newGameState.playerHands[opponentId] = newGameState.playerHands[opponentId].filter((c:CardData) => c.id !== opponentCard.id);
    newGameState.roundWinner = winnerId;
    newGameState.roundResultText = resultText;
    newGameState.roundResultDetail = resultDetail;
    
    if(isHost) {
        updateRTDBGameState('duel', game.id, newGameState).then(() => {
            setTimeout(() => {
                checkGameEnd(newGameState);
            }, 2000);
        });
    }
  };
  
  const checkGameEnd = (currentGameState: DuelGameState) => {
     if(!user || !opponentId || !game || !isHost) return;

      const p1Id = game.playerIds[0];
      const p2Id = game.playerIds[1];
      let ended = false;
      let finalWinnerId: string | 'draw' | null = null;
      let finalStatus: 'finished' | 'in-progress' = 'in-progress';
      
      if (currentGameState.only[p1Id] > 0) { ended = true; finalWinnerId = p1Id; }
      else if (currentGameState.only[p2Id] > 0) { ended = true; finalWinnerId = p2Id; }
      else if (currentGameState.kyuso[p1Id] >= 3) { ended = true; finalWinnerId = p1Id; }
      else if (currentGameState.kyuso[p2Id] >= 3) { ended = true; finalWinnerId = p2Id; }
      else if (currentGameState.currentRound >= TOTAL_ROUNDS) {
          ended = true;
          if (currentGameState.scores[p1Id] > currentGameState.scores[p2Id]) finalWinnerId = p1Id;
          else if (currentGameState.scores[p2Id] > currentGameState.scores[p1Id]) finalWinnerId = p2Id;
          else finalWinnerId = 'draw';
      }

      if (ended) {
          finalStatus = 'finished';
          if (finalWinnerId && finalWinnerId !== 'draw') {
             awardPoints(finalWinnerId, 1);
          }
          const finalState = { ...currentGameState, status: finalStatus, winner: finalWinnerId };
          updateRTDBGameState('duel', game.id, finalState);
      } else {
          const nextRoundState: DuelGameState = {
              ...currentGameState,
              currentRound: currentGameState.currentRound + 1,
              moves: { [p1Id]: null, [p2Id]: null },
              roundWinner: null,
              roundResultText: '',
              roundResultDetail: '',
          };
          updateRTDBGameState('duel', game.id, nextRoundState);
      }
  };

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId);
    toast({ title: t('gameIdCopied') });
  };
  
  const handleForfeit = async () => {
    if (user && gameId) {
        await leaveRTDBGame('duel', gameId, user.uid);
        router.push('/online');
    }
  };

  if (!user || !game) {
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
  
  if (!gameState || !gameState.playerHands || Object.keys(gameState.playerHands).length < 2) {
     return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game state...</div>;
  }

  const PlayerInfo = ({ uid }: { uid: string }) => {
    const player = game?.players[uid];
    if (!player) return null;
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative">
                <Avatar className="w-16 h-16">
                    <AvatarImage src={player.photoURL ?? undefined} />
                    <AvatarFallback className="text-2xl">{player.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <span className={`absolute bottom-0 right-0 block h-4 w-4 rounded-full ${player.online ? 'bg-green-500' : 'bg-gray-400'} border-2 border-background`} />
            </div>
            <p className="font-bold text-lg">{uid === user.uid ? t('you') : player.displayName}</p>
        </div>
    );
  }
  
  const ScoreDisplay = () => {
    if (!game || !gameState || !game.playerIds[0] || !game.playerIds[1] || !gameState.scores) {
      return null;
    }
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

  const myMove = gameState?.moves?.[user.uid];
  const opponentMove = opponentId ? gameState?.moves?.[opponentId] : null;
  const myCards = gameState.playerHands?.[user.uid] ?? [];

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
        <span>{t('round')} {gameState?.currentRound > TOTAL_ROUNDS ? TOTAL_ROUNDS : gameState?.currentRound} / {TOTAL_ROUNDS}</span>
      </div>
      <ScoreDisplay />
      
      {game.status !== 'finished' && gameState && (
        <>
          {!gameState.roundWinner && (
            <div className="my-8">
                {myMove == null ? (
                    <>
                        <h3 className="text-xl font-bold mb-4">{t('selectCard')}</h3>
                        <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                            {myCards.sort((a,b) => a.number - b.number).map(card => (
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
