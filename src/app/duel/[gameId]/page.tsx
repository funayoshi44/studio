"use client";

import { useState, useContext, useEffect } from 'react';
// import { GameContext } from '@/contexts/game-context';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
// import { subscribeToGame, submitMove, type Game } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Game } from '@/lib/firestore';


const TOTAL_ROUNDS = 13;

type DuelGameState = {
  currentRound: number;
  // Cards are now indexed by player UID
  playerHands: { [uid: string]: number[] };
  scores: { [uid: string]: number };
  kyuso: { [uid: string]: number };
  only: { [uid: string]: number };
  // Keep track of moves for the current round
  moves: { [uid: string]: number | null };
  lastMoveBy: string | null;
  history: { [round: number]: { [uid: string]: number } };
  roundWinner: string | null; // UID of winner or 'draw'
  roundResultText: string;
  roundResultDetail: string;
};

const initialDuelGameState: DuelGameState = {
  currentRound: 1,
  playerHands: {},
  scores: {},
  kyuso: {},
  only: {},
  moves: {},
  lastMoveBy: null,
  history: {},
  roundWinner: null,
  roundResultText: '',
  roundResultDetail: '',
};

export default function OnlineDuelPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { toast } = useToast();

  const t = useTranslation();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);

  // THIS PAGE IS DISABLED FOR NOW
  useEffect(() => {
    toast({ title: "Online play is currently disabled.", variant: 'destructive'});
    router.push('/');
  }, [router, toast]);


  const gameState = game?.gameState as DuelGameState | undefined;
  const opponent = game && user ? game.playerIds.find(p => p !== user.uid) : null;
  const opponentInfo = opponent ? game?.players[opponent] : null;

  // Subscribe to game updates
  useEffect(() => {
    if (!gameId || !user) return;
    // const unsubscribe = subscribeToGame(gameId, (gameData) => {
    //   if (gameData) {
    //     // First time load or game reset
    //     if (Object.keys(gameData.gameState).length === 0) {
    //        initializeGameState(gameData);
    //     } else {
    //        setGame(gameData);
    //     }
    //   } else {
    //     toast({ title: "Error", description: "Game not found.", variant: 'destructive' });
    //     router.push('/online');
    //   }
    // });
    // return () => unsubscribe();
  }, [gameId, user, router, toast]);

  // Evaluate round when both players have moved
  useEffect(() => {
    if (!game || !gameState || !user || !opponent) return;

    const playerMove = gameState.moves?.[user.uid];
    const opponentMove = gameState.moves?.[opponent];

    if (playerMove && opponentMove && gameState.roundWinner === null) {
      evaluateRound(playerMove, opponentMove);
    }
  }, [game?.gameState]);


  const initializeGameState = async (gameData: Game) => {
    const p1 = gameData.playerIds[0];
    const p2 = gameData.playerIds[1];
    if (!p1 || !p2) return;

    const newGameState: DuelGameState = {
        ...initialDuelGameState,
        playerHands: {
            [p1]: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1),
            [p2]: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)
        },
        scores: { [p1]: 0, [p2]: 0 },
        kyuso: { [p1]: 0, [p2]: 0 },
        only: { [p1]: 0, [p2]: 0 },
        moves: { [p1]: null, [p2]: null },
    };
    // await submitMove(gameId, user!.uid, { '.nan': null }); // a little hack to update game state
    setGame({ ...gameData, gameState: newGameState });
  };
  
  const handleSelectCard = async (card: number) => {
    if (loading || !user || !game || !gameState) return;
    if (gameState.moves?.[user.uid]) return; // Already moved

    setLoading(true);
    // await submitMove(gameId, user.uid, card);
    setLoading(false);
  };
  
  const evaluateRound = async (playerCard: number, opponentCard: number) => {
    if (!user || !opponent || !gameState) return;

    let winnerId: string | 'draw' = 'draw';
    let resultText = '';
    let resultDetail = '';
    let isSpecialWin = false;
    let winType = '';
    
    let currentGameState = { ...gameState };

    // Determine winner
    if (playerCard === 1 && opponentCard === 13) { winnerId = user.uid; winType = 'only'; } 
    else if (opponentCard === 1 && playerCard === 13) { winnerId = opponent; winType = 'only'; } 
    else if (playerCard === opponentCard - 1) { winnerId = user.uid; winType = 'kyuso'; }
    else if (opponentCard === playerCard - 1) { winnerId = opponent; winType = 'kyuso'; }
    else if (playerCard > opponentCard) { winnerId = user.uid; }
    else if (opponentCard > playerCard) { winnerId = opponent; }

    // Update scores and special win counts
    if (winnerId !== 'draw') {
        currentGameState.scores[winnerId]++;
        if (winType === 'only') {
            currentGameState.only[winnerId]++;
            resultDetail = t('duelResultOnlyOne');
            isSpecialWin = true;
        } else if (winType === 'kyuso') {
            currentGameState.kyuso[winnerId]++;
            resultDetail = t('duelResultKyuso');
        }
    }
    
    resultText = winnerId === user.uid ? t('youWin') : winnerId === opponent ? t('cpuWins') : t('draw');
    if(!resultDetail) resultDetail = `${playerCard} vs ${opponentCard}`;

    // Update game state for UI before checking game end
    const roundHistory = { [user.uid]: playerCard, [opponent]: opponentCard };
    currentGameState.history[currentGameState.currentRound] = roundHistory;
    currentGameState.playerHands[user.uid] = currentGameState.playerHands[user.uid].filter(c => c !== playerCard);
    currentGameState.playerHands[opponent] = currentGameState.playerHands[opponent].filter(c => c !== opponentCard);
    currentGameState.roundWinner = winnerId;
    currentGameState.roundResultText = resultText;
    currentGameState.roundResultDetail = resultDetail;

    setGame(prev => ({...prev!, gameState: currentGameState}));

    // Wait a bit so players can see the result, then check for game end or advance
    setTimeout(() => {
        checkGameEnd(currentGameState, winnerId);
    }, 2000);
  };
  
  const checkGameEnd = (currentGameState: DuelGameState, winnerId: string | 'draw') => {
     if(!user || !opponent) return;

      let ended = false;
      let finalWinnerId: string | 'draw' | null = null;

      if (currentGameState.only[user.uid] > 0) { ended = true; finalWinnerId = user.uid; }
      else if (currentGameState.only[opponent] > 0) { ended = true; finalWinnerId = opponent; }
      else if (currentGameState.kyuso[user.uid] >= 3) { ended = true; finalWinnerId = user.uid; }
      else if (currentGameState.kyuso[opponent] >= 3) { ended = true; finalWinnerId = opponent; }
      else if (currentGameState.currentRound >= TOTAL_ROUNDS) {
          ended = true;
          if (currentGameState.scores[user.uid] > currentGameState.scores[opponent]) finalWinnerId = user.uid;
          else if (currentGameState.scores[opponent] > currentGameState.scores[user.uid]) finalWinnerId = opponent;
          else finalWinnerId = 'draw';
      }

      if (ended) {
          // Set final game state
          setGame(prev => ({...prev!, status: 'finished', winner: finalWinnerId}));
      } else {
          // Advance to next round
          const nextGameState: DuelGameState = {
              ...currentGameState,
              currentRound: currentGameState.currentRound + 1,
              moves: { [user.uid]: null, [opponent]: null },
              roundWinner: null,
              roundResultText: '',
              roundResultDetail: '',
          };
          setGame(prev => ({...prev!, gameState: nextGameState}));
      }
  };

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId);
    toast({ title: t('gameIdCopied') });
  };
  
  if (!user || !game) {
    return <div className="text-center py-10">Loading game...</div>;
  }

  if (game.status === 'waiting') {
    return (
        <div className="text-center py-10">
            <h2 className="text-2xl font-bold mb-4">{t('waitingForPlayer')}</h2>
            <p className="mb-4 text-muted-foreground">Share this game ID with your friend:</p>
            <div className="flex items-center justify-center gap-2 mb-6">
                <code className="p-2 bg-muted rounded-md">{gameId}</code>
                <Button onClick={handleCopyGameId} size="icon" variant="ghost"><Copy className="h-4 w-4"/></Button>
            </div>
            <p>Or share the URL.</p>
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mt-8"></div>
        </div>
    );
  }

  const PlayerInfo = ({ uid }: { uid: string }) => {
    const player = game?.players[uid];
    if (!player) return null;
    return (
        <div className="flex flex-col items-center gap-2">
            <Avatar>
                <AvatarImage src={player.photoURL} />
                <AvatarFallback>{player.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <p className="font-bold">{uid === user.uid ? t('you') : player.displayName}</p>
        </div>
    );
  }
  
  const ScoreDisplay = () => (
    <div className="flex justify-center space-x-4 md:space-x-8 text-lg mb-4">
      {user && gameState && (
        <Card className="p-4 bg-blue-100 dark:bg-blue-900/50">
          <p className="font-bold">{t('you')}: {gameState.scores?.[user.uid] ?? 0} {t('wins')}</p>
          <div className="text-sm opacity-80">
            <span>{t('kyuso')}: {gameState.kyuso?.[user.uid] ?? 0} | </span>
            <span>{t('onlyOne')}: {gameState.only?.[user.uid] ?? 0}</span>
          </div>
        </Card>
      )}
      {opponent && gameState && (
         <Card className="p-4 bg-red-100 dark:bg-red-900/50">
            <p className="font-bold">{opponentInfo?.displayName}: {gameState.scores?.[opponent] ?? 0} {t('wins')}</p>
            <div className="text-sm opacity-80">
                <span>{t('kyuso')}: {gameState.kyuso?.[opponent] ?? 0} | </span>
                <span>{t('onlyOne')}: {gameState.only?.[opponent] ?? 0}</span>
            </div>
        </Card>
      )}
    </div>
  );

  const myMove = gameState?.moves?.[user.uid];
  const opponentMove = opponent ? gameState?.moves?.[opponent] : null;

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-2">{t('duelTitle')} - Online</h2>
      <div className="mb-4 text-muted-foreground">
        <span>{t('round')} {gameState?.currentRound ?? 0 > TOTAL_ROUNDS ? TOTAL_ROUNDS : gameState?.currentRound ?? 0} / {TOTAL_ROUNDS}</span>
      </div>
      <ScoreDisplay />
      
      {game.status !== 'finished' && gameState && (
        <>
          {!gameState.roundWinner && (
            <div className="my-8">
                {!myMove ? (
                    <>
                        <h3 className="text-xl font-bold mb-4">{t('selectCard')}</h3>
                        <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto">
                            {gameState.playerHands?.[user.uid]?.map(card => (
                            <Button key={card} onClick={() => handleSelectCard(card)} disabled={loading} className="w-16 h-20 text-lg font-bold transition-transform hover:scale-110">
                                {card}
                            </Button>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-xl font-semibold text-muted-foreground animate-pulse">{t('waitingForOpponentMove')}</p>
                )}
            </div>
          )}

          {(myMove !== null) && (
            <div className="my-8">
              <div className="flex justify-around items-center">
                <div className="text-center">
                  <PlayerInfo uid={user.uid} />
                  <div className={`mt-2 w-24 h-32 bg-blue-600 rounded-lg flex items-center justify-center text-3xl font-bold border-4 border-blue-400`}>{myMove ?? '?'}</div>
                </div>
                <div className="text-2xl font-bold">VS</div>
                <div className="text-center">
                  {opponent && <PlayerInfo uid={opponent} />}
                  <div className={`mt-2 w-24 h-32 bg-red-600 rounded-lg flex items-center justify-center text-3xl font-bold border-4 border-red-400`}>{opponentMove ?? '?'}</div>
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
                {game.winner === user.uid && t('duelFinalResultWin')}
                {game.winner === opponent && t('duelFinalResultLoss')}
                {game.winner === 'draw' && t('duelFinalResultDraw')}
            </p>
            {/* <p className="text-xl mb-6 text-muted-foreground">{state.finalDetail}</p> */}
            <div className="space-x-4">
                <Link href="/online" passHref>
                    <Button size="lg">{t('playAgain')}</Button>
                </Link>
                <Link href="/" passHref>
                    <Button variant="secondary" size="lg">{t('backToMenu')}</Button>
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
