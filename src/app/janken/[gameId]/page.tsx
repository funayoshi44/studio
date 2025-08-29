
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { subscribeToGame, submitMove, updateShardedGameState, leaveGame, type Game, getCards, type CardData } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Loader2, Copy, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { VictoryAnimation } from '@/components/victory-animation';
import Image from 'next/image';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getJankenActions, type JankenAction } from '@/lib/firestore';


type Move = 'rock' | 'paper' | 'scissors';
const moves: Move[] = ['rock', 'paper', 'scissors'];

type JankenGameState = {
    round: number;
    scores: { [uid: string]: number };
    phase: 'initial' | 'final' | 'result';
    moves: {
        [uid: string]: {
            initial: Move | null;
            final: Move | null;
        }
    };
    roundWinner: string | null | 'draw';
    roundResultText: string;
};


const JankenMoveButton = ({ action, move, onSelect, disabled }: { action?: JankenAction, move: Move, onSelect: (move: Move) => void, disabled: boolean }) => {
    const getJankenEmoji = (move: Move) => {
        if (!move) return '?';
        const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
        return emojiMap[move];
    };
    
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

const JankenMoveSelector = ({ onSelect, disabled, jankenActions }: { onSelect: (move: Move) => void; disabled: boolean, jankenActions: { [key in Move]?: JankenAction } }) => {
    return (
        <div className="flex justify-center space-x-4">
        {moves.map(move => (
            <JankenMoveButton 
                key={move}
                move={move}
                action={jankenActions[move]}
                onSelect={onSelect}
                disabled={disabled}
            />
        ))}
        </div>
    )
}

export default function OnlineJankenPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const gameId = params.gameId as string;
    const { t } = useTranslation();
    const { toast } = useToast();

    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(false);
    const [jankenActions, setJankenActions] = useState<{ [uid: string]: { [key in Move]?: JankenAction } }>({});

    const gameState = game?.gameState as JankenGameState | undefined;
    const opponent = useMemo(() => game?.playerIds.find(p => p !== user?.uid), [game, user]);

    useEffect(() => {
        if (!gameId || !user) return;
        const unsubscribe = subscribeToGame(gameId, (gameData) => {
            if (gameData) {
                if (!gameData.playerIds.includes(user.uid)) {
                    toast({ title: "Access Denied", description: "You are not a player in this game.", variant: 'destructive' });
                    router.push('/online');
                    return;
                }
                setGame(gameData);
            } else {
                toast({ title: "Error", description: "Game not found.", variant: 'destructive' });
                router.push('/online');
            }
        });
        return () => unsubscribe();
    }, [gameId, user, router, toast]);

    useEffect(() => {
        if (!game) return;
        const fetchAllActions = async () => {
            const allActions: { [uid: string]: { [key in Move]?: JankenAction } } = {};
            for (const uid of game.playerIds) {
                try {
                    allActions[uid] = await getJankenActions(uid);
                } catch (error) {
                    console.error(`Failed to fetch janken actions for user ${uid}`, error);
                }
            }
            setJankenActions(allActions);
        };
        fetchAllActions();
    }, [game]);


    const handleSelectMove = async (move: Move) => {
        if (!user || !gameState) return;
        setLoading(true);
        try {
            await submitMove(gameId, user.uid, move);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to submit move.", variant: 'destructive' });
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

    const MoveDisplay = ({ uid, phase }: { uid: string, phase: 'initial' | 'final' | 'result' }) => {
        if (!gameState) return null;
        const playerMoves = gameState.moves[uid];
        const move = phase === 'result' ? playerMoves.final : playerMoves[phase];

        const getJankenEmoji = (m: Move | null) => {
            if (!m) return '?';
            const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
            return emojiMap[m];
        };
        
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

        // If the current user, or if the round is over, always show the move.
        if (uid === user?.uid || phase === 'result') {
            return renderContent();
        }

        // If it's an opponent and the move has been made, show a confirmation but not the move itself.
        if (move) {
             return <div className="w-24 h-32 flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-700 rounded-lg">✅</div>;
        }

        return renderContent();
    };


    if (!user || !game || !gameState || !opponent) {
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
                <Loader2 className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-8"/>
            </div>
        );
    }
    
     if (game.status === 'finished') {
        return (
            <div className="my-8 text-center">
                {game.winner === user.uid && <VictoryAnimation />}
                <p className="text-4xl font-bold mb-4">
                    {game.winner === 'draw' ? t('draw') : `${game.players[game.winner as string]?.displayName} ${t('winsTheGame')}!`}
                </p>
                <div className="space-x-4 mt-6">
                    <Link href="/online" passHref>
                        <Button size="lg">{t('backToMenu')}</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const myMoves = gameState.moves[user.uid];
    const opponentMoves = gameState.moves[opponent];
    const myJankenActions = jankenActions[user.uid] || {};


    return (
        <div className="text-center">
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
            
            <div className="mb-4 text-muted-foreground">{t('round')} {gameState.round}</div>
            
            <div className="flex justify-center space-x-4 md:space-x-8 text-lg mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg font-bold">{t('you')}: {gameState.scores[user.uid]} {t('wins')}</div>
                <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-lg font-bold">{game.players[opponent].displayName}: {gameState.scores[opponent]} {t('wins')}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-8">
                <div className="flex flex-col items-center gap-2">
                    <Avatar className="w-16 h-16"><AvatarImage src={user.photoURL ?? undefined} /><AvatarFallback>{user.displayName?.[0]}</AvatarFallback></Avatar>
                    <p className="font-bold">{user.displayName}</p>
                </div>
                 <div className="flex flex-col items-center gap-2">
                    <Avatar className="w-16 h-16"><AvatarImage src={game.players[opponent].photoURL ?? undefined} /><AvatarFallback>{game.players[opponent].displayName?.[0]}</AvatarFallback></Avatar>
                    <p className="font-bold">{game.players[opponent].displayName}</p>
                </div>
            </div>

            {gameState.phase !== 'result' && (
                <div className="my-8">
                    <h3 className="text-xl font-bold mb-4">{gameState.phase === 'initial' ? t('jankenPhase1Title') : t('jankenPhase2Title')}</h3>
                     {gameState.phase === 'final' && (
                        <div className="text-sm text-muted-foreground mb-4">Opponent's first move was: {getJankenEmoji(opponentMoves.initial)}</div>
                     )}
                    <JankenMoveSelector onSelect={handleSelectMove} disabled={loading || (myMoves && myMoves[gameState.phase] != null)} jankenActions={myJankenActions} />
                    {myMoves && myMoves[gameState.phase] && opponentMoves && !opponentMoves[gameState.phase] && (
                        <p className="mt-4 animate-pulse">{t('waitingForOpponentMove')}</p>
                    )}
                </div>
            )}
            
            <div className="my-8 space-y-4">
                 <div>
                    <h4 className="font-bold">{t('firstMoves')}</h4>
                    <div className="flex justify-around items-center text-4xl mt-2">
                        <MoveDisplay uid={user.uid} phase="initial"/>
                        <MoveDisplay uid={opponent} phase="initial"/>
                    </div>
                </div>
                {gameState.phase === 'result' && (
                    <div>
                        <h4 className="font-bold">{t('finalResult')}</h4>
                         <div className="flex justify-around items-center text-4xl mt-2">
                             <MoveDisplay uid={user.uid} phase="result"/>
                             <MoveDisplay uid={opponent} phase="result"/>
                        </div>
                    </div>
                )}
            </div>

            {gameState.phase === 'result' && (
                <div className="my-6">
                    <p className="text-2xl font-bold mb-4 animate-pulse">{gameState.roundResultText}</p>
                </div>
            )}
            
        </div>
    );
}

function getJankenEmoji(move: "rock" | "paper" | "scissors" | null): React.ReactNode {
    if (!move) return '?';
    const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
    return emojiMap[move];
}
