
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { leaveRTDBGame, updateRTDBGameState, submitRTDBMove, setupPresence, teardownPresence, setPlayerOnlineStatus } from '@/lib/rtdb';
import { awardPoints } from '@/lib/firestore';
import { useCardCache } from '@/contexts/card-cache-context';
import { onValue, ref, off, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

const TOTAL_ROUNDS = 13;

type PlayerHand = Omit<CardData, 'title' | 'caption' | 'frontImageUrl' | 'backImageUrl'>[];
type LightCard = { id: string; suit: string; rank: number | string; number: number; };


export default function OnlineDuelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { toast } = useToast();
  const playVictorySound = useVictorySound();
  const { cards: allCards, loading: cardsLoading } = useCardCache();
  const cardMap = useMemo(() => new Map(allCards.map(c => [c.id, c])), [allCards]);

  const { t } = useTranslation();

  // Granular state management
  const [gameStatus, setGameStatus] = useState<'waiting' | 'in-progress' | 'finished' | null>(null);
  const [gamePlayers, setGamePlayers] = useState<any>(null);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | 'draw' | null | undefined>(null);
  
  // Granular game state
  const [currentRound, setCurrentRound] = useState(1);
  const [playerHands, setPlayerHands] = useState<{ [uid: string]: PlayerHand }>({});
  const [scores, setScores] = useState<{ [uid: string]: number }>({});
  const [kyuso, setKyuso] = useState<{ [uid: string]: number }>({});
  const [only, setOnly] = useState<{ [uid: string]: number }>({});
  const [moves, setMoves] = useState<{ [uid: string]: LightCard | null }>({});
  const [roundWinner, setRoundWinner] = useState<string | null | 'draw'>(null);
  const [roundResultText, setRoundResultText] = useState('');
  const [roundResultDetail, setRoundResultDetail] = useState('');

  const [loading, setLoading] = useState(false);
  
  const opponentId = useMemo(() => playerIds.find(p => p !== user?.uid), [playerIds, user]);
  const isHost = useMemo(() => user && playerIds.length > 0 && playerIds[0] === user.uid, [user, playerIds]);


  // Setup user presence in RTDB
  useEffect(() => {
    if (user) {
        setupPresence(user.uid);
    }
    return () => {
        teardownPresence();
    }
  }, [user]);

  // Subscribe to game updates from RTDB using granular listeners
  useEffect(() => {
    if (!gameId || !user) return;
    
    const base = `lobbies/duel/${gameId}`;
    const gs = `${base}/gameState`;
    const unsubs: Array<() => void> = [];

    // Lightweight fields
    unsubs.push(onValue(ref(rtdb, `${base}/status`), s => setGameStatus(s.val())));
    unsubs.push(onValue(ref(rtdb, `${base}/players`), s => setGamePlayers(s.val())));
    unsubs.push(onValue(ref(rtdb, `${base}/winner`), s => setWinner(s.val())));

    // Minimal game state fields
    unsubs.push(onValue(ref(rtdb, `${gs}/currentRound`), s => setCurrentRound(s.val() ?? 1)));
    unsubs.push(onValue(ref(rtdb, `${gs}/scores`), s => setScores(s.val() ?? {})));
    unsubs.push(onValue(ref(rtdb, `${gs}/kyuso`), s => setKyuso(s.val() ?? {})));
    unsubs.push(onValue(ref(rtdb, `${gs}/only`), s => setOnly(s.val() ?? {})));
    unsubs.push(onValue(ref(rtdb, `${gs}/roundWinner`), s => setRoundWinner(s.val() ?? null)));
    unsubs.push(onValue(ref(rtdb, `${gs}/roundResultText`), s => setRoundResultText(s.val() ?? '')));
    unsubs.push(onValue(ref(rtdb, `${gs}/roundResultDetail`), s => setRoundResultDetail(s.val() ?? '')));

    // Subscribe to my own hand
    unsubs.push(onValue(ref(rtdb, `${gs}/playerHands/${user.uid}`), s => {
        setPlayerHands(prev => ({ ...prev, [user.uid]: s.val() ?? [] }));
    }));

    // Subscribe to my own move
    unsubs.push(onValue(ref(rtdb, `${gs}/moves/${user.uid}`), s => {
        setMoves(prev => ({ ...prev, [user.uid]: s.val() ?? null }));
    }));

    // Subscribe to opponent's move once opponentId is known
    let oppUnsub: (() => void) | null = null;
    const attachOpponentListener = (oppId?: string) => {
        if (oppUnsub) { oppUnsub(); oppUnsub = null; } // Clean up old listener
        if (!oppId) return;
        
        oppUnsub = onValue(ref(rtdb, `${gs}/moves/${oppId}`), s => {
            setMoves(prev => ({ ...prev, [oppId]: s.val() ?? null }));
        });
        unsubs.push(() => oppUnsub && oppUnsub());
    };
    
    // Subscribe to playerIds to know when opponent joins/leaves
    const playerIdsUnsub = onValue(ref(rtdb, `${base}/playerIds`), snap => {
        const ids = snap.val() || [];
        setPlayerIds(ids);
        const currentOpponent = ids.find((p: string) => p !== user.uid);
        attachOpponentListener(currentOpponent);
    });
    unsubs.push(playerIdsUnsub);

    // Update my online status within the game
    setPlayerOnlineStatus('duel', gameId, user.uid, true);

    // Unsubscribe from all listeners on cleanup
    return () => {
       unsubs.forEach(unsubscribe => unsubscribe());
       if (user) {
         setPlayerOnlineStatus('duel', gameId, user.uid, false);
       }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user]);

  // Redirect if player is not in game
   useEffect(() => {
    if (gameStatus && gameStatus !== 'waiting' && playerIds.length > 0 && user && !playerIds.includes(user.uid)) {
      toast({ title: "Access Denied", description: "You are not a player in this game.", variant: 'destructive' });
      router.push('/online');
    }
   },[gameStatus, playerIds, user, router, toast]);


  // Evaluate round when both players have moved
  useEffect(() => {
    if (!user || !opponentId || !isHost) return;

    const myMove = moves?.[user.uid];
    const opponentMove = moves?.[opponentId];

    if (myMove != null && opponentMove != null && roundWinner === null) {
      evaluateRound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, user, opponentId, isHost, roundWinner]);

  // Play sound/animation on win
  useEffect(() => {
    if (user) {
        const isGameWinner = winner && (Array.isArray(winner) ? winner.includes(user.uid) : winner === user.uid);
        if (roundWinner === user.uid || isGameWinner) {
            playVictorySound();
        }
    }
  }, [roundWinner, winner, user, playVictorySound]);
  
  const handleSelectCard = async (card: CardData) => {
    if (loading || !user) return;
    if (moves?.[user.uid]) return;

    setLoading(true);
    try {
      // The full CardData object is passed here, but submitRTDBMove will only store the lightweight version
      await submitRTDBMove('duel', gameId, user.uid, card);
    } catch (error) {
      console.error("Failed to submit move:", error);
      toast({ title: "Error", description: "Failed to submit move.", variant: 'destructive' });
    }
    setLoading(false);
  };
  
  const evaluateRound = () => {
    if (!user || !opponentId || !gamePlayers) return;

    let winnerId: string | 'draw' = 'draw';
    let resultText = '';
    let resultDetail = '';
    let winType = '';
    
    let newScores = { ...scores };
    let newKyuso = { ...kyuso };
    let newOnly = { ...only };
    let newPlayerHands = { ...playerHands };

    const myCard = rehydrateCard(moves[user.uid]);
    const opponentCard = rehydrateCard(moves[opponentId]);
    
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
        newScores[winnerId] = (newScores[winnerId] || 0) + 1;
        if (winType === 'only') {
            newOnly[winnerId] = (newOnly[winnerId] || 0) + 1;
            resultDetail = t('duelResultOnlyOne');
        } else if (winType === 'kyuso') {
            newKyuso[winnerId] = (newKyuso[winnerId] || 0) + 1;
            resultDetail = t('duelResultKyuso');
        }
    }
    
    if (winnerId === 'draw') {
        resultText = t('draw');
    } else {
        const winnerName = gamePlayers[winnerId]?.displayName ?? 'Player';
        resultText = `${winnerName} ${t('wins')}!`;
    }

    if(!resultDetail) resultDetail = `${gamePlayers[user.uid]?.displayName ?? 'You'}: ${myCardNumber} vs ${gamePlayers[opponentId]?.displayName ?? 'Opponent'}: ${opponentCardNumber}`;

    // Filter hands using the card's ID
    newPlayerHands[user.uid] = newPlayerHands[user.uid].filter((c: any) => c.id !== myCard.id);
    
    // Instead of reading opponent hand from DB, just update our local copy
    setPlayerHands(prev => ({
        ...prev,
        [user.uid]: newPlayerHands[user.uid]
    }));
    
    const updates: any = {};
    const gameBasePath = `lobbies/duel/${gameId}`;
    const gameStatePath = `${gameBasePath}/gameState`;

    updates[`${gameStatePath}/scores`] = newScores;
    updates[`${gameStatePath}/kyuso`] = newKyuso;
    updates[`${gameStatePath}/only`] = newOnly;
    updates[`${gameStatePath}/playerHands/${user.uid}`] = newPlayerHands[user.uid];
    updates[`${gameStatePath}/roundWinner`] = winnerId;
    updates[`${gameStatePath}/roundResultText`] = resultText;
    updates[`${gameStatePath}/roundResultDetail`] = resultDetail;
    updates[`${gameStatePath}/lastHistory`] = { round: currentRound, [user.uid]: moves[user.uid], [opponentId]: moves[opponentId] };

    
    if(isHost) {
        update(ref(rtdb), updates).then(() => {
            setTimeout(() => {
                checkGameEnd(newScores, newKyuso, newOnly);
            }, 2000);
        });
    }
  };
  
  const checkGameEnd = (currentScores: any, currentKyuso: any, currentOnly: any) => {
     if(!user || !opponentId || !isHost) return;

      const p1Id = playerIds[0];
      const p2Id = playerIds[1];
      let ended = false;
      let finalWinnerId: string | 'draw' | null = null;
      let finalStatus: 'finished' | 'in-progress' = 'in-progress';
      
      if (currentOnly[p1Id] > 0) { ended = true; finalWinnerId = p1Id; }
      else if (currentOnly[p2Id] > 0) { ended = true; finalWinnerId = p2Id; }
      else if (currentKyuso[p1Id] >= 3) { ended = true; finalWinnerId = p1Id; }
      else if (currentKyuso[p2Id] >= 3) { ended = true; finalWinnerId = p2Id; }
      else if (currentRound >= TOTAL_ROUNDS) {
          ended = true;
          if (currentScores[p1Id] > currentScores[p2Id]) finalWinnerId = p1Id;
          else if (currentScores[p2Id] > currentScores[p1Id]) finalWinnerId = p2Id;
          else finalWinnerId = 'draw';
      }

      if (ended) {
          finalStatus = 'finished';
          // Award points should be handled by a cloud function, not here.
          const finalUpdates: any = {};
          finalUpdates[`lobbies/duel/${gameId}/status`] = finalStatus;
          finalUpdates[`lobbies/duel/${gameId}/winner`] = finalWinnerId;
          update(ref(rtdb), finalUpdates);

      } else {
            const updates: any = {};
            const gameStatePath = `lobbies/duel/${gameId}/gameState`;
            updates[`${gameStatePath}/currentRound`] = currentRound + 1;
            updates[`${gameStatePath}/moves`] = { [p1Id]: null, [p2Id]: null };
            updates[`${gameStatePath}/roundWinner`] = null;
            updates[`${gameStatePath}/roundResultText`] = '';
            updates[`${gameStatePath}/roundResultDetail`] = '';
            update(ref(rtdb), updates);
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

  const rehydrateCard = (lightCard: LightCard | null): CardData | null => {
      if (!lightCard) return null;
      const fullCard = cardMap.get(lightCard.id);
      return fullCard ? { ...fullCard, ...lightCard } : null;
  }

  if (!user || !gameStatus || !gamePlayers || cardsLoading) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game...</div>;
  }
  
  if (gameStatus === 'waiting') {
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
  
  if (!playerHands || !playerHands[user.uid]) {
     return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game state...</div>;
  }

  const PlayerInfo = ({ uid }: { uid: string }) => {
    const player = gamePlayers?.[uid];
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
    if (!playerIds[0] || !playerIds[1] || !scores) {
      return null;
    }
    const p1Id = playerIds[0];
    const p2Id = playerIds[1];
    if (!gamePlayers[p1Id] || !gamePlayers[p2Id]) return null;

    return (
      <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-8 text-base mb-4">
          <>
            <Card className="p-3 md:p-4 bg-blue-100 dark:bg-blue-900/50">
              <p className="font-bold">{gamePlayers[p1Id].displayName}: {scores?.[p1Id] ?? 0} {t('wins')}</p>
              <div className="text-sm opacity-80">
                <span>{t('kyuso')}: {kyuso?.[p1Id] ?? 0} | </span>
                <span>{t('onlyOne')}: {only?.[p1Id] ?? 0}</span>
              </div>
            </Card>
             <Card className="p-3 md:p-4 bg-red-100 dark:bg-red-900/50">
                <p className="font-bold">{gamePlayers[p2Id].displayName}: {scores?.[p2Id] ?? 0} {t('wins')}</p>
                <div className="text-sm opacity-80">
                    <span>{t('kyuso')}: {kyuso?.[p2Id] ?? 0} | </span>
                    <span>{t('onlyOne')}: {only?.[p2Id] ?? 0}</span>
                </div>
            </Card>
          </>
      </div>
    );
  };

  const myLightHand = playerHands?.[user.uid] ?? [];
  const myFullHand = myLightHand.map(rehydrateCard).filter((c): c is CardData => c !== null);
  const myMove = rehydrateCard(moves?.[user.uid]);
  const opponentMove = opponentId ? rehydrateCard(moves?.[opponentId]) : null;

  return (
    <div className="text-center">
      {roundWinner === user.uid && <VictoryAnimation />}
      {winner === user.uid && <VictoryAnimation />}

      <div className="flex justify-between items-center mb-2">
        <div className="w-1/3"></div>
        <div className="w-1/3 text-center">
            <h2 className="text-3xl font-bold">{t('duelTitle')} - Online</h2>
        </div>
        <div className="w-1/3 flex justify-end">
             {gameStatus === 'in-progress' && (
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
        <span>{t('round')} {currentRound > TOTAL_ROUNDS ? TOTAL_ROUNDS : currentRound} / {TOTAL_ROUNDS}</span>
      </div>
      <ScoreDisplay />
      
      {gameStatus !== 'finished' && (
        <>
          {!roundWinner && (
            <div className="my-8">
                {myMove == null ? (
                    <>
                        <h3 className="text-xl font-bold mb-4">{t('selectCard')}</h3>
                        <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                            {myFullHand.sort((a,b) => a.number - b.number).map(card => (
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

          {roundWinner && (
            <div className="my-6">
              <p className="text-2xl font-bold mb-2">{roundResultText}</p>
              <p className="text-lg text-muted-foreground">{roundResultDetail}</p>
            </div>
          )}
        </>
      )}

      {gameStatus === 'finished' && (
        <div className="my-8">
            <p className="text-4xl font-bold mb-4">
                {winner === 'draw'
                    ? t('duelFinalResultDraw')
                    : winner ? `${gamePlayers[winner as string]?.displayName ?? 'Player'} ${t('winsTheGame')}!` : "Game Over"}
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
