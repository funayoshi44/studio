
"use client";

import { useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { subscribeToGame, submitMove, updateGameState, type Game, subscribeToMessages, sendMessage, type Message, leaveGame } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Copy, Send, Flag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { GameCard } from '@/components/ui/game-card';

const TOTAL_ROUNDS = 13;

type DuelGameState = {
  currentRound: number;
  // Cards are now indexed by player UID
  playerHands: { [uid: string]: number[] };
  scores: { [uid:string]: number };
  kyuso: { [uid:string]: number };
  only: { [uid:string]: number };
  // Keep track of moves for the current round
  moves: { [uid: string]: number | null };
  lastMoveBy: string | null;
  history: { [round: number]: { [uid: string]: number } };
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

  const t = useTranslation();
  const [game, setGame] = useState<Game | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const gameState = game?.gameState as DuelGameState | undefined;
  const opponentId = game && user ? game.playerIds.find(p => p !== user.uid) : null;
  const opponentInfo = opponentId ? game?.players[opponentId] : null;

  // Handle user leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
        if (user && gameId && game?.status === 'in-progress') {
            leaveGame(gameId, user.uid);
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameId, user, game?.status]);


  // Subscribe to game and message updates
  useEffect(() => {
    if (!gameId || !user) return;
    const unsubscribeGame = subscribeToGame(gameId, (gameData) => {
      if (gameData) {
        // If user is not part of the game, redirect them.
        if (!gameData.playerIds.includes(user.uid)) {
            toast({ title: "Access Denied", description: "You are not a player in this game.", variant: 'destructive' });
            router.push('/online');
            return;
        }

        // Check if opponent has disconnected
        if (game?.status === 'in-progress' && gameData.status === 'finished' && gameData.winner === user.uid) {
            toast({ title: t('opponentDisconnectedTitle'), description: t('opponentDisconnectedBody') });
        }

        setGame(gameData);
      } else {
        toast({ title: "Error", description: "Game not found.", variant: 'destructive' });
        router.push('/online');
      }
    });

    const unsubscribeMessages = subscribeToMessages(gameId, setMessages);

    return () => {
      unsubscribeGame();
      unsubscribeMessages();
    };
  }, [gameId, user, router, toast, game?.status, t]);

  // Evaluate round when both players have moved
  useEffect(() => {
    if (!game || !gameState || !user || !opponentId) return;

    // Only the host (player 1) evaluates the round to prevent duplicate updates
    if (user.uid !== game.playerIds[0]) return;

    const playerMove = gameState.moves?.[user.uid];
    const opponentMove = gameState.moves?.[opponentId];

    // Check if both moves have been made and the round winner hasn't been decided yet
    if (playerMove != null && opponentMove != null && gameState.roundWinner === null) {
      evaluateRound(playerMove, opponentMove);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.gameState, game?.playerIds, user, opponentId]);
  
  const handleSelectCard = async (card: number) => {
    if (loading || !user || !game || !gameState) return;
    if (gameState.moves?.[user.uid]) return; // Already moved

    setLoading(true);
    try {
      await submitMove(gameId, user.uid, card);
    } catch (error) {
      console.error("Failed to submit move:", error);
      toast({ title: "Error", description: "Failed to submit move.", variant: 'destructive' });
    }
    setLoading(false);
  };
  
  const evaluateRound = (playerCard: number, opponentCard: number) => {
    if (!user || !opponentId || !gameState || !game) return;

    let winnerId: string | 'draw' = 'draw';
    let resultText = '';
    let resultDetail = '';
    let winType = '';
    
    // Create a mutable copy of the current game state
    let newGameState = JSON.parse(JSON.stringify(gameState));

    const p1Id = game.playerIds[0];
    const p2Id = game.playerIds[1];
    
    // Determine which card belongs to which player regardless of who is evaluating
    const p1Card = newGameState.moves[p1Id];
    const p2Card = newGameState.moves[p2Id];

    if (p1Card === null || p2Card === null) return; // Should not happen, but a safeguard

    // Determine winner
    if (p1Card === 1 && p2Card === 13) { winnerId = p1Id; winType = 'only'; } 
    else if (p2Card === 1 && p1Card === 13) { winnerId = p2Id; winType = 'only'; } 
    else if (p1Card === p2Card - 1) { winnerId = p1Id; winType = 'kyuso'; }
    else if (p2Card === p1Card - 1) { winnerId = p2Id; winType = 'kyuso'; }
    else if (p1Card > p2Card) { winnerId = p1Id; }
    else if (p2Card > p1Card) { winnerId = p2Id; }


    // Update scores and special win counts
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

    if(!resultDetail) resultDetail = `${game.players[p1Id]?.displayName ?? 'P1'}: ${p1Card} vs ${game.players[p2Id]?.displayName ?? 'P2'}: ${p2Card}`;

    // Update game state for UI before checking game end
    const roundHistory = { [p1Id]: p1Card, [p2Id]: p2Card };
    newGameState.history[newGameState.currentRound] = roundHistory;
    newGameState.playerHands[p1Id] = newGameState.playerHands[p1Id].filter((c:number) => c !== p1Card);
    newGameState.playerHands[p2Id] = newGameState.playerHands[p2Id].filter((c:number) => c !== p2Card);
    newGameState.roundWinner = winnerId;
    newGameState.roundResultText = resultText;
    newGameState.roundResultDetail = resultDetail;
    
    // The evaluation should only happen once, by the host (player 1).
    // This prevents race conditions.
    if(user.uid === p1Id) {
        updateGameState(game.id, newGameState).then(() => {
            setTimeout(() => {
                // Pass the updated state to checkGameEnd
                checkGameEnd(newGameState);
            }, 2000);
        });
    }
  };
  
  const checkGameEnd = (currentGameState: DuelGameState) => {
     if(!user || !opponentId || !game) return;

      const p1Id = game.playerIds[0];
      const p2Id = game.playerIds[1];
      let ended = false;
      let finalWinnerId: string | 'draw' | null = null;
      
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
          // Set final game state on the server
          if(user.uid === p1Id) {
            updateGameState(game.id, { ...currentGameState, status: 'finished', winner: finalWinnerId });
          }
      } else {
          // Advance to next round on the server
          const nextRoundState: DuelGameState = {
              ...currentGameState,
              currentRound: currentGameState.currentRound + 1,
              moves: { [p1Id]: null, [p2Id]: null },
              roundWinner: null,
              roundResultText: '',
              roundResultDetail: '',
          };
          if(user.uid === p1Id) {
            updateGameState(game.id, nextRoundState);
          }
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !gameId || !newMessage.trim()) return;

    try {
      await sendMessage(gameId, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        text: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Error", description: "Failed to send message.", variant: 'destructive' });
    }
  };

  const ChatBox = () => (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>{t('chat')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 overflow-y-auto p-4 border rounded-md mb-4 flex flex-col-reverse bg-muted/50">
          <div className="flex flex-col-reverse gap-4">
          {messages.map(msg => (
            <div key={msg.id} className="flex items-start gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={msg.photoURL ?? undefined} />
                <AvatarFallback>{msg.displayName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-bold text-sm">{msg.displayName}</p>
                <p className="text-sm bg-background p-2 rounded-lg">{msg.text}</p>
              </div>
            </div>
          ))}
          </div>
        </div>
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('sendAMessage')}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
  
  if (!user || !game) {
    return <div className="text-center py-10">Loading game...</div>;
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
            <ChatBox />
        </div>
    );
  }
  
  if (!gameState || !gameState.playerHands || Object.keys(gameState.playerHands).length < 2) {
     return <div className="text-center py-10">Loading game state...</div>;
  }

  const PlayerInfo = ({ uid }: { uid: string }) => {
    const player = game?.players[uid];
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
    const p1Id = game.playerIds[0];
    const p2Id = game.playerIds[1];

    if (!p1Id || !p2Id || !game.players[p1Id] || !game.players[p2Id] || !gameState || !gameState.scores) {
      return null;
    }

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
                            {myCards.sort((a,b) => a-b).map(card => (
                              <button key={card} onClick={() => handleSelectCard(card)} disabled={loading} className="transition-transform hover:scale-105">
                                  <GameCard number={card} revealed={true} />
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
                  <div className="mt-2"><GameCard number={myMove} revealed={true}/></div>
                </div>
                <div className="text-2xl font-bold">VS</div>
                <div className="text-center">
                  {opponentId && <PlayerInfo uid={opponentId} />}
                  <div className="mt-2"><GameCard number={opponentMove} revealed={opponentMove !== null}/></div>
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
                    : game.winner ? `${game.players[game.winner]?.displayName ?? 'Player'} ${t('winsTheGame')}!` : "Game Over"}
            </p>
            <div className="space-x-4 mt-6">
                <Link href="/online" passHref>
                    <Button size="lg">{t('backToMenu')}</Button>
                </Link>
          </div>
        </div>
      )}

      <ChatBox />

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

    
