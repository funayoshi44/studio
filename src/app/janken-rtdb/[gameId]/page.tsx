
"use client";

import { useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { JankenAction } from '@/lib/firestore';
import { useJankenGame } from '@/hooks/use-janken-game';
import { OnlineGamePlayerInfo } from '@/components/online-game/player-info';
import { OnlineGameScoreDisplay } from '@/components/online-game/score-display';
import { OnlineGameWaitingScreen } from '@/components/online-game/waiting-screen';
import { OnlineGameForfeitButton } from '@/components/online-game/forfeit-button';
import { OnlineGameResultScreen } from '@/components/online-game/result-screen';

type Move = 'rock' | 'paper' | 'scissors';
const moves: Move[] = ['rock', 'paper', 'scissors'];

const getJankenEmoji = (move: Move | null) => {
    if (!move) return '❓';
    const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
    return emojiMap[move];
};


export default function RTDBOnlineJankenPage() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const { gameId, gameState, loading, error } = useJankenGame();
    
    const {
        status,
        players,
        playerIds,
        winner,
        currentRound,
        scores,
        phase,
        movesState,
        roundWinner,
        roundResultText,
        jankenActions,
        isSubmittingMove,
        handleSelectMove,
    } = gameState;

    const opponentId = useMemo(() => playerIds.find(p => p !== user?.uid), [playerIds, user]);
    const myMoves = useMemo(() => movesState?.[user?.uid ?? ''], [movesState, user]);
    const opponentMoves = useMemo(() => (opponentId ? movesState?.[opponentId] : null), [movesState, opponentId]);

    const JankenMoveButton = ({ action, move, onSelect, disabled }: { action?: JankenAction, move: Move, onSelect: (move: Move) => void, disabled: boolean }) => {
        const content = action ? (
            <div className="relative w-full h-full">
                <Image src={action.imageUrl} alt={action.title} layout="fill" objectFit="cover" className="rounded-md" unoptimized />
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

    const MoveDisplay = ({ uid, phase }: { uid: string, phase: 'initial' | 'final' | 'result' }) => {
        if (!players || !movesState) return null;
        const playerMoves = movesState[uid];
        const move = phase === 'result' ? playerMoves?.final : playerMoves?.[phase];
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
                                    <Image src={action.imageUrl} alt={action.title} layout="fill" objectFit="cover" className="rounded-lg" unoptimized/>
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

        if (uid === user?.uid || phase === 'result') {
            return renderContent();
        }

        // Opponent's move, not yet revealed
        return <div className="w-24 h-32 flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-700 rounded-lg">{move ? '✅' : '❓'}</div>
    };
    
    if (loading || !user) {
        return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game...</div>;
    }

    if (status === 'waiting') {
        return <OnlineGameWaitingScreen gameId={gameId} />;
    }

    if (error) {
        return <div className="text-center text-destructive py-10">{error}</div>
    }

    if (status === 'finished') {
        return <OnlineGameResultScreen gameType="janken" winner={winner} players={players} />;
    }

    return (
        <div className="text-center">
            <div className="flex justify-between items-center mb-2">
                <div/>
                <h2 className="text-3xl font-bold">{t('jankenTitle')} - Online</h2>
                <OnlineGameForfeitButton gameType="janken" gameId={gameId} />
            </div>
            
            <div className="mb-4 text-muted-foreground">{t('round')} {currentRound}</div>
            
            <OnlineGameScoreDisplay players={players} playerIds={playerIds} scores={scores} />

            <div className="grid grid-cols-2 gap-4 my-8">
                {playerIds.map(uid => (
                    <OnlineGamePlayerInfo key={uid} uid={uid} players={players} />
                ))}
            </div>

            {phase !== 'result' && (
                <div className="my-8">
                    <h3 className="text-xl font-bold mb-4">{phase === 'initial' ? t('jankenPhase1Title') : t('jankenPhase2Title')}</h3>
                     {phase === 'final' && opponentId && opponentMoves?.initial && (
                        <div className="text-sm text-muted-foreground mb-4 flex justify-center items-center gap-2">
                            Opponent's first move was: <div className="w-16 h-20 flex items-center justify-center text-3xl bg-gray-200 dark:bg-gray-700 rounded-lg">{getJankenEmoji(opponentMoves.initial)}</div>
                        </div>
                     )}
                     <JankenMoveSelector onSelect={handleSelectMove} disabled={isSubmittingMove || (myMoves && myMoves[phase] != null)} />
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
            
        </div>
    );
}
