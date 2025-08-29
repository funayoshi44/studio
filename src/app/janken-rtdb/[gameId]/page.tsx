
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Copy, Flag, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Image from 'next/image';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVictorySound } from '@/hooks/use-victory-sound';
import { VictoryAnimation } from '@/components/victory-animation';
import type { JankenAction } from '@/lib/firestore';
import { getJankenActions } from '@/lib/firestore';
import { rtdb } from '@/lib/firebase';
import { onValue, ref, update } from 'firebase/database';
import { leaveRTDBGame, setupPresence, submitRTDBMove, teardownPresence, setPlayerOnlineStatus } from '@/lib/rtdb';


type Move = 'rock' | 'paper' | 'scissors';
const moves: Move[] = ['rock', 'paper', 'scissors'];

const getJankenEmoji = (move: Move | null) => {
    if (!move) return '❓';
    const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
    return emojiMap[move];
};


export default function RTDBOnlineJankenPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const gameId = params.gameId as string;
    const { toast } = useToast();
    const { t } = useTranslation();
    const playVictorySound = useVictorySound();

    const [gameStatus, setGameStatus] = useState<'waiting' | 'in-progress' | 'finished' | null>(null);
    const [gamePlayers, setGamePlayers] = useState<any>(null);
    const [playerIds, setPlayerIds] = useState<string[]>([]);
    const [winner, setWinner] = useState<string | 'draw' | null | undefined>(null);

    const [currentRound, setCurrentRound] = useState(1);
    const [scores, setScores] = useState<{ [uid: string]: number }>({});
    const [phase, setPhase] = useState<'initial' | 'final' | 'result'>('initial');
    const [movesState, setMovesState] = useState<{ [uid: string]: { initial: Move | null, final: Move | null } }>({});
    const [roundWinner, setRoundWinner] = useState<string | null | 'draw'>(null);
    const [roundResultText, setRoundResultText] = useState('');

    const [loading, setLoading] = useState(false);
    const [jankenActions, setJankenActions] = useState<{ [uid: string]: { [key in Move]?: JankenAction } }>({});

    const opponentId = useMemo(() => playerIds.find(p => p !== user?.uid), [playerIds, user]);
    const isHost = useMemo(() => user && playerIds.length > 0 && playerIds[0] === user.uid, [user, playerIds]);


    // Setup user presence
    useEffect(() => {
        if (user) {
            setupPresence(user.uid);
        }
        return () => {
            teardownPresence();
        }
    }, [user]);

    // Granular subscription to RTDB
    useEffect(() => {
        if (!gameId || !user) return;
        const base = `lobbies/janken/${gameId}`;
        const gs = `${base}/gameState`;
        const unsubs: Array<() => void> = [];

        unsubs.push(onValue(ref(rtdb, `${base}/status`), s => setGameStatus(s.val())));
        unsubs.push(onValue(ref(rtdb, `${base}/players`), s => setGamePlayers(s.val())));
        unsubs.push(onValue(ref(rtdb, `${base}/winner`), s => setWinner(s.val())));
        unsubs.push(onValue(ref(rtdb, `${base}/playerIds`), s => setPlayerIds(s.val() ?? [])));
        
        unsubs.push(onValue(ref(rtdb, `${gs}/currentRound`), s => setCurrentRound(s.val() ?? 1)));
        unsubs.push(onValue(ref(rtdb, `${gs}/scores`), s => setScores(s.val() ?? {})));
        unsubs.push(onValue(ref(rtdb, `${gs}/phase`), s => setPhase(s.val() ?? 'initial')));
        unsubs.push(onValue(ref(rtdb, `${gs}/moves`), s => setMovesState(s.val() ?? {})));
        unsubs.push(onValue(ref(rtdb, `${gs}/roundWinner`), s => setRoundWinner(s.val() ?? null)));
        unsubs.push(onValue(ref(rtdb, `${gs}/roundResultText`), s => setRoundResultText(s.val() ?? '')));
        
        setPlayerOnlineStatus('janken', gameId, user.uid, true);

        return () => {
            unsubs.forEach(u => u());
            setPlayerOnlineStatus('janken', gameId, user.uid, false);
        };
    }, [gameId, user]);
    
    // Fetch custom janken actions for all players
    useEffect(() => {
        if (!gamePlayers || playerIds.length === 0) return;
        const fetchAllActions = async () => {
            const allActions: { [uid: string]: { [key in Move]?: JankenAction } } = {};
            for (const uid of playerIds) {
                try {
                    const userActions = await getJankenActions(uid);
                    allActions[uid] = userActions;
                } catch (error) {
                    console.error(`Failed to fetch janken actions for user ${uid}`, error);
                }
            }
            setJankenActions(allActions);
        };
        fetchAllActions();
    }, [gamePlayers, playerIds]);


    // Game Logic evaluation effect
    useEffect(() => {
        if (!isHost || !user || !opponentId || !movesState || !gamePlayers) return;

        const myMoves = movesState[user.uid];
        const opponentMoves = movesState[opponentId];

        if (phase === 'initial' && myMoves?.initial && opponentMoves?.initial) {
            update(ref(rtdb, `lobbies/janken/${gameId}/gameState`), { phase: 'final' });
        } else if (phase === 'final' && myMoves?.final && opponentMoves?.final) {
            evaluateRound();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [movesState, phase, isHost, user, opponentId, gamePlayers]);

    // Play sound/animation on win
    useEffect(() => {
        if (user && roundWinner === user.uid) {
            playVictorySound();
        }
    }, [roundWinner, user, playVictorySound]);
    
    const handleSelectMove = async (move: Move) => {
        if (loading || !user || roundWinner || phase === 'result') return;
        const myCurrentMoves = movesState?.[user.uid];
        if (myCurrentMoves && myCurrentMoves[phase]) return; // Already moved

        setLoading(true);
        try {
            await submitRTDBMove('janken', gameId, user.uid, move, phase);
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
        if (!isHost || !user || !opponentId || !movesState) return;
        
        const p1Id = playerIds[0];
        const p2Id = playerIds[1];
        const p1Moves = movesState[p1Id];
        const p2Moves = movesState[p2Id];

        if (!p1Moves?.final || !p2Moves?.final || !p1Moves?.initial || !p2Moves?.initial) return;

        const p1Changed = p1Moves.initial !== p1Moves.final;
        const p2Changed = p2Moves.initial !== p2Moves.final;

        let winnerId: string | 'draw' = 'draw';
        let resultText = '';
        
        if (p1Changed && !checkWin(p1Moves.final, p2Moves.final) && p1Moves.final !== p2Moves.final) {
            resultText = `${gamePlayers[p2Id].displayName} ${t('wins')}! (${gamePlayers[p1Id].displayName}'s penalty)`;
            winnerId = p2Id;
        } else if (p2Changed && !checkWin(p2Moves.final, p1Moves.final) && p2Moves.final !== p1Moves.final) {
            resultText = `${gamePlayers[p1Id].displayName} ${t('wins')}! (${gamePlayers[p2Id].displayName}'s penalty)`;
            winnerId = p1Id;
        } else if (checkWin(p1Moves.final, p2Moves.final)) {
            resultText = `${gamePlayers[p1Id].displayName} ${t('wins')}!`;
            winnerId = p1Id;
        } else if (checkWin(p2Moves.final, p1Moves.final)) {
            resultText = `${gamePlayers[p2Id].displayName} ${t('wins')}!`;
            winnerId = p2Id;
        } else {
            resultText = t('draw');
        }
        
        const newScores = {...scores};
        if (winnerId !== 'draw') {
            newScores[winnerId] = (newScores[winnerId] || 0) + 1;
        }

        const updates: any = {};
        const gameStatePath = `lobbies/janken/${gameId}/gameState`;
        updates[`${gameStatePath}/scores`] = newScores;
        updates[`${gameStatePath}/roundWinner`] = winnerId;
        updates[`${gameStatePath}/roundResultText`] = resultText;
        updates[`${gameStatePath}/phase`] = 'result';

        update(ref(rtdb), updates).then(() => {
            setTimeout(nextRound, 3000);
        });
    };

    const nextRound = () => {
        if (!isHost) return;
        const updates: any = {};
        const gameStatePath = `lobbies/janken/${gameId}/gameState`;
        updates[`${gameStatePath}/currentRound`] = currentRound + 1;
        updates[`${gameStatePath}/phase`] = 'initial';
        updates[`${gameStatePath}/roundWinner`] = null;
        updates[`${gameStatePath}/roundResultText`] = '';
        updates[`${gameStatePath}/moves`] = {
            [playerIds[0]]: { initial: null, final: null },
            [playerIds[1]]: { initial: null, final: null },
        };
        update(ref(rtdb), updates);
    };

    const handleCopyGameId = () => {
        navigator.clipboard.writeText(gameId);
        toast({ title: t('gameIdCopied') });
    };

    const handleForfeit = async () => {
        if (user && gameId) {
            await leaveRTDBGame('janken', gameId, user.uid);
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
        if (!gamePlayers || !movesState) return null;
        const playerMoves = movesState[uid];
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

        if (phase === 'result' || (phase === 'final' && phase === 'initial') || uid === user?.uid) {
            return renderContent();
        }

        // Opponent's move, not yet revealed
        return <div className="w-24 h-32 flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-700 rounded-lg">{move ? '✅' : '❓'}</div>
    };
    
    
    if (!user || !gameStatus || !gamePlayers) {
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
                <Loader2 className="animate-spin h-8 w-8 mx-auto mb-8" />
            </div>
        );
    }
    
    const myMoves = movesState?.[user.uid];
    const opponentMoves = opponentId ? movesState?.[opponentId] : null;

    return (
        <div className="text-center">
            {roundWinner === user.uid && <VictoryAnimation />}
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
            
            <div className="mb-4 text-muted-foreground">{t('round')} {currentRound}</div>
            
            {/* Score Display */}
            <div className="flex justify-center space-x-4 md:space-x-8 text-lg mb-8">
                {playerIds.map(uid => (
                    <div key={uid} className="bg-card p-3 rounded-lg font-bold">
                       {gamePlayers[uid]?.displayName ?? 'Player'}: {scores[uid] ?? 0} {t('wins')}
                    </div>
                ))}
            </div>

            {/* Game Area */}
            <div className="grid grid-cols-2 gap-4 my-8">
                {playerIds.map(uid => (
                    <div key={uid} className="flex flex-col items-center gap-2">
                         <div className="relative">
                            <Avatar className="w-16 h-16">
                                <AvatarImage src={gamePlayers[uid]?.photoURL ?? undefined} />
                                <AvatarFallback className="text-2xl">{gamePlayers[uid]?.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className={`absolute bottom-0 right-0 block h-4 w-4 rounded-full ${gamePlayers[uid]?.online ? 'bg-green-500' : 'bg-gray-400'} border-2 border-background`} />
                        </div>
                        <p className="font-bold text-lg">{uid === user?.uid ? t('you') : gamePlayers[uid]?.displayName}</p>
                    </div>
                ))}
            </div>


            {phase !== 'result' && (
                <div className="my-8">
                    <h3 className="text-xl font-bold mb-4">{phase === 'initial' ? t('jankenPhase1Title') : t('jankenPhase2Title')}</h3>
                     {phase === 'final' && opponentId && (
                        <div className="text-sm text-muted-foreground mb-4 flex justify-center items-center gap-2">
                            Opponent's first move was: <MoveDisplay uid={opponentId} phase='initial'/>
                        </div>
                     )}
                     <JankenMoveSelector onSelect={handleSelectMove} disabled={loading || (myMoves && myMoves[phase] != null)} />
                    {myMoves && myMoves[phase] && opponentMoves && !opponentMoves[phase] && (
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
                {phase === 'result' && (
                    <div>
                        <h4 className="font-bold">{t('finalResult')}</h4>
                         <div className="flex justify-around items-center text-4xl mt-2">
                            {user.uid && <MoveDisplay uid={user.uid} phase="final"/>}
                            {opponentId && <MoveDisplay uid={opponentId} phase="final"/>}
                        </div>
                    </div>
                )}
            </div>

            {phase === 'result' && (
                <div className="my-6">
                    <p className="text-2xl font-bold mb-4 animate-pulse">{roundResultText}</p>
                </div>
            )}
            
            <Link href="/online" passHref><Button variant="secondary">{t('backToMenu')}</Button></Link>
        </div>
    );
}
