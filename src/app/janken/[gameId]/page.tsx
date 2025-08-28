
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { subscribeToGame, submitMove, updateGameState, type Game, leaveGame, getJankenActions, type JankenAction } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Copy, Flag, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Image from 'next/image';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVictorySound } from '@/hooks/use-victory-sound';
import { VictoryAnimation } from '@/components/victory-animation';


type Move = 'rock' | 'paper' | 'scissors';
const moves: Move[] = ['rock', 'paper', 'scissors'];

type JankenGameState = {
    currentRound: number;
    scores: { [uid: string]: number };
    moves: { [uid: string]: { initial: Move | null, final: Move | null } };
    phase: 'initial' | 'final' | 'result';
    roundWinner: string | 'draw' | null;
    roundResultText: string;
};

const getJankenEmoji = (move: Move | null) => {
    if (!move) return '❓';
    const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
    return emojiMap[move];
};


export default function OnlineJankenPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const gameId = params.gameId as string;
    const { toast } = useToast();
    const { t } = useTranslation();
    const playVictorySound = useVictorySound();

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(false);
    const [jankenActions, setJankenActions] = useState<{ [uid: string]: { [key in Move]?: JankenAction } }>({});


    const gameState = game?.gameState as JankenGameState | undefined;
    const opponentId = game && user ? game.playerIds.find(p => p !== user.uid) : null;
    
    // Fetch custom janken actions for all players in the game
    useEffect(() => {
        if (!game) return;
        const fetchAllActions = async () => {
            const allActions: { [uid: string]: { [key in Move]?: JankenAction } } = {};
            for (const uid of game.playerIds) {
                const userActions = await getJankenActions(uid);
                allActions[uid] = userActions;
            }
            setJankenActions(allActions);
        };
        fetchAllActions();
    }, [game]);


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
                if (game?.status === 'in-progress' && gameData.status === 'finished' && gameData.winner === user.uid) {
                    toast({ title: t('opponentDisconnectedTitle'), description: t('opponentDisconnectedBody') });
                }
                setGame(gameData);
            } else {
                toast({ title: "Error", description: "Game not found.", variant: 'destructive' });
                router.push('/online');
            }
        });
        return () => unsubscribe();
    }, [gameId, user, router, toast, t, game?.status]);
    
    // Evaluate game when moves are made
    useEffect(() => {
        if (!game || !gameState || !user || !opponentId) return;
        // Only host evaluates to prevent race conditions
        if (user.uid !== game.playerIds[0]) return;

        const myMoves = gameState.moves[user.uid];
        const opponentMoves = gameState.moves[opponentId];

        if (gameState.phase === 'initial' && myMoves.initial && opponentMoves.initial) {
            // Both made initial move, advance phase
            updateGameState(gameId, { ...gameState, phase: 'final' });
        } else if (gameState.phase === 'final' && myMoves.final && opponentMoves.final) {
            // Both made final move, evaluate round
            evaluateRound();
        }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game?.gameState, game?.playerIds, user?.uid, opponentId]);

    // Play sound/animation on win
    useEffect(() => {
        if (user && gameState && gameState.roundWinner === user.uid) {
            playVictorySound();
        }
    }, [gameState, user, playVictorySound]);
    
    const handleSelectMove = async (move: Move) => {
        if (loading || !user || !game || !gameState || gameState.roundWinner) return;
        const currentPhase = gameState.phase;
        if (currentPhase !== 'initial' && currentPhase !== 'final') return;
        if (gameState.moves[user.uid]?.[currentPhase]) return; // Already moved

        setLoading(true);
        try {
            await submitMove(gameId, user.uid, move, currentPhase);
        } catch (error) {
            console.error("Failed to submit move:", error);
            toast({ title: "Error", description: "Failed to submit move.", variant: 'destructive' });
        }
        setLoading(false);
    };

    const checkWin = (move1: Move, move2: Move) => {
        return (
          (move1 === 'rock' && move2 === 'scissors') ||
          (move1 === 'paper' && move2 === 'rock') ||
          (move1 === 'scissors' && move2 === 'paper')
        );
    };

    const evaluateRound = () => {
        if (!game || !gameState || !user || !opponentId) return;

        const p1Id = game.playerIds[0];
        const p2Id = game.playerIds[1];
        const p1Moves = gameState.moves[p1Id];
        const p2Moves = gameState.moves[p2Id];

        if (!p1Moves.final || !p2Moves.final) return;
        if (!p1Moves.initial || !p2Moves.initial) return; // safeguard

        const p1Changed = p1Moves.initial !== p1Moves.final;
        const p2Changed = p2Moves.initial !== p2Moves.final;

        let winner: string | 'draw' = 'draw';
        let resultText = '';
        
        // Apply penalty rule first
        if (p1Changed && !checkWin(p1Moves.final, p2Moves.final) && p1Moves.final !== p2Moves.final) {
            resultText = `${game.players[p2Id].displayName} ${t('wins')}! (${game.players[p1Id].displayName}'s penalty)`;
            winner = p2Id;
        } else if (p2Changed && !checkWin(p2Moves.final, p1Moves.final) && p2Moves.final !== p1Moves.final) {
            resultText = `${game.players[p1Id].displayName} ${t('wins')}! (${game.players[p2Id].displayName}'s penalty)`;
            winner = p1Id;
        } else if (checkWin(p1Moves.final, p2Moves.final)) {
            // Standard win for Player 1
            resultText = `${game.players[p1Id].displayName} ${t('wins')}!`;
            winner = p1Id;
        } else if (checkWin(p2Moves.final, p1Moves.final)) {
            // Standard win for Player 2
            resultText = `${game.players[p2Id].displayName} ${t('wins')}!`;
            winner = p2Id;
        } else {
            // Draw without any penalties
            resultText = t('draw');
        }
        
        const newScores = {...gameState.scores};
        if (winner !== 'draw') {
            newScores[winner]++;
        }

        const evaluatedState = {
            ...gameState,
            scores: newScores,
            roundWinner: winner,
            roundResultText: resultText,
            phase: 'result',
        };
        
        updateGameState(gameId, evaluatedState).then(() => {
            setTimeout(() => nextRound(), 3000);
        });
    };

    const nextRound = () => {
        if (!game || !gameState || user?.uid !== game.playerIds[0]) return;
        
        const nextState: JankenGameState = {
            currentRound: gameState.currentRound + 1,
            scores: gameState.scores,
            moves: {
                [game.playerIds[0]]: { initial: null, final: null },
                [game.playerIds[1]]: { initial: null, final: null },
            },
            phase: 'initial',
            roundWinner: null,
            roundResultText: '',
        };
        updateGameState(gameId, nextState);
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
    
    const JankenMoveButton = ({ action, move, onSelect, disabled }: { action?: JankenAction, move: Move, onSelect: (move: Move) => void, disabled: boolean }) => {
        const content = action ? (
            <div className="relative w-full h-full">
                <Image src={action.imageUrl} alt={action.title} layout="fill" objectFit="cover" className="rounded-md" />
            </div>
        ) : (
            <span className="text-4xl">{getJankenEmoji(move)}</span>
        );
        
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={() => onSelect(move)} size="lg" className="w-24 h-24 p-0" disabled={disabled}>
                            {content}
                        </Button>
                    </TooltipTrigger>
                    {action && (
                        <TooltipContent>
                            <p className="font-bold">{action.title}</p>
                            <p className="text-sm text-muted-foreground">{action.comment}</p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
        )
    }

    const JankenMoveSelector = ({ onSelect, disabled }: { onSelect: (move: Move) => void; disabled: boolean }) => {
        if (!user) return null;
        const myJankenActions = jankenActions[user.uid] || {};
        
        return (
            <div className="flex justify-center space-x-4">
            {moves.map(move => (
                <JankenMoveButton 
                    key={move}
                    move={move}
                    action={myJankenActions[move]}
                    onSelect={onSelect}
                    disabled={disabled}
                />
            ))}
            </div>
        )
    }

    const MoveDisplay = ({ uid, phase }: { uid: string, phase: 'initial' | 'final' }) => {
        if (!game || !gameState) return null;
        const playerMoves = gameState.moves[uid];
        const move = playerMoves?.[phase];
        const action = jankenActions[uid]?.[move!];
        
        const renderContent = () => {
            if (!move) {
                 return <div className="w-24 h-32 flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-700 rounded-lg">?</div>;
            }
            if (action) {
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                               <div className="relative w-24 h-32">
                                    <Image src={action.imageUrl} alt={action.title} layout="fill" objectFit="cover" className="rounded-lg" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-bold">{action.title}</p>
                                <p className="text-sm text-muted-foreground">{action.comment}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            }
            return <div className="w-24 h-32 flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-700 rounded-lg">{getJankenEmoji(move)}</div>;
        }

        if (gameState.phase === 'result' || (gameState.phase === 'final' && phase === 'initial') || uid === user?.uid) {
            return renderContent();
        }

        // Opponent's move, not yet revealed
        return <div className="w-24 h-32 flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-700 rounded-lg">{move ? '✅' : '❓'}</div>
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
                <Loader2 className="animate-spin h-8 w-8 mx-auto mb-8" />
            </div>
        );
    }
    
    const myMoves = gameState.moves[user.uid];
    const opponentMoves = opponentId ? gameState.moves[opponentId] : null;

    return (
        <div className="text-center">
            {gameState.roundWinner === user.uid && <VictoryAnimation />}
            <div className="flex justify-between items-center mb-2">
                <div/>
                <h2 className="text-3xl font-bold">{t('jankenTitle')} - Online</h2>
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
            
            <div className="mb-4 text-muted-foreground">{t('round')} {gameState.currentRound}</div>
            
            {/* Score Display */}
            <div className="flex justify-center space-x-4 md:space-x-8 text-lg mb-8">
                {game.playerIds.map(uid => (
                    <div key={uid} className="bg-card p-3 rounded-lg font-bold">
                       {game.players[uid]?.displayName ?? 'Player'}: {gameState.scores[uid]} {t('wins')}
                    </div>
                ))}
            </div>

            {/* Game Area */}
            <div className="grid grid-cols-2 gap-4 my-8">
                {game.playerIds.map(uid => (
                    <div key={uid} className="flex flex-col items-center gap-2">
                        <Avatar className="w-16 h-16">
                            <AvatarImage src={game.players[uid]?.photoURL ?? undefined} />
                            <AvatarFallback className="text-2xl">{game.players[uid]?.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                        <p className="font-bold text-lg">{uid === user?.uid ? t('you') : game.players[uid]?.displayName}</p>
                    </div>
                ))}
            </div>


            {gameState.phase !== 'result' && (
                <div className="my-8">
                    <h3 className="text-xl font-bold mb-4">{gameState.phase === 'initial' ? t('jankenPhase1Title') : t('jankenPhase2Title')}</h3>
                     {gameState.phase === 'final' && opponentId && (
                        <div className="text-sm text-muted-foreground mb-4 flex justify-center items-center gap-2">
                            Opponent's first move was: <MoveDisplay uid={opponentId} phase='initial'/>
                        </div>
                     )}
                     <JankenMoveSelector onSelect={handleSelectMove} disabled={loading || myMoves[gameState.phase] != null} />
                    {myMoves[gameState.phase] && opponentMoves && !opponentMoves[gameState.phase] && (
                        <p className="mt-4 animate-pulse">{t('waitingForOpponentMove')}</p>
                    )}
                </div>
            )}
            
            <div className="my-8 space-y-4">
                 <div>
                    <h4 className="font-bold">{t('firstMoves')}</h4>
                    <div className="flex justify-around items-center text-4xl mt-2">
                        {user.uid && <MoveDisplay uid={user.uid} phase="initial"/>}
                        {opponentId && <MoveDisplay uid={opponentId} phase="initial"/>}
                    </div>
                </div>
                {gameState.phase === 'result' && (
                    <div>
                        <h4 className="font-bold">{t('finalResult')}</h4>
                         <div className="flex justify-around items-center text-4xl mt-2">
                            {user.uid && <MoveDisplay uid={user.uid} phase="final"/>}
                            {opponentId && <MoveDisplay uid={opponentId} phase="final"/>}
                        </div>
                    </div>
                )}
            </div>

            {gameState.phase === 'result' && (
                <div className="my-6">
                    <p className="text-2xl font-bold mb-4 animate-pulse">{gameState.roundResultText}</p>
                </div>
            )}
            
            <Link href="/online" passHref><Button variant="secondary">{t('backToMenu')}</Button></Link>
        </div>
    );
}
