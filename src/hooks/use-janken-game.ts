
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { onValue, ref, update, get } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { setupPresence, teardownPresence, setPlayerOnlineStatus, submitRTDBMove } from '@/lib/rtdb';
import { getJankenActions, type JankenAction } from '@/lib/firestore';
import { useTranslation } from './use-translation';

type Move = 'rock' | 'paper' | 'scissors';

export function useJankenGame() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const gameId = params.gameId as string;
    const { toast } = useToast();
    const { t } = useTranslation();

    const [status, setStatus] = useState<'waiting' | 'in-progress' | 'finished' | null>(null);
    const [players, setPlayers] = useState<any>(null);
    const [playerIds, setPlayerIds] = useState<string[]>([]);
    const [hostId, setHostId] = useState<string | null>(null);
    const [winner, setWinner] = useState<string | 'draw' | null | undefined>(null);
    const [currentRound, setCurrentRound] = useState(1);
    const [scores, setScores] = useState<{ [uid: string]: number }>({});
    const [phase, setPhase] = useState<'initial' | 'final' | 'result'>('initial');
    const [movesState, setMovesState] = useState<{ [uid: string]: { initial: Move | null, final: Move | null } }>({});
    const [roundWinner, setRoundWinner] = useState<string | null | 'draw'>(null);
    const [roundResultText, setRoundResultText] = useState('');
    const [jankenActions, setJankenActions] = useState<{ [uid: string]: { [key in Move]?: JankenAction } }>({});
    const [isSubmittingMove, setIsSubmittingMove] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const opponentId = useMemo(() => playerIds.find(p => p !== user?.uid), [playerIds, user]);
    const isHost = useMemo(() => user && hostId === user.uid, [user, hostId]);

    useEffect(() => {
        if (user) setupPresence(user.uid);
        return () => teardownPresence();
    }, [user]);
    
    useEffect(() => {
        if (!gameId || !user) return;
        const base = `lobbies/janken/${gameId}`;
        const gs = `${base}/gameState`;
        const unsubs: Array<() => void> = [];

        const checkGameExists = async () => {
            const snap = await get(ref(rtdb, base));
            if (!snap.exists()) {
                setError("Game not found or has been deleted.");
                toast({ title: "Error", description: "Game not found.", variant: 'destructive'});
                router.push('/online');
                return false;
            }
            if (snap.val().playerIds && !snap.val().playerIds.includes(user.uid) && snap.val().status !== 'waiting') {
                setError("You are not a player in this game.");
                toast({ title: "Access Denied", description: "You are not a player in this game.", variant: 'destructive'});
                router.push('/online');
                return false;
            }
            return true;
        }

        checkGameExists().then(exists => {
            if (!exists) return;
            
            unsubs.push(onValue(ref(rtdb, `${base}/status`), s => setStatus(s.val())));
            unsubs.push(onValue(ref(rtdb, `${base}/players`), s => setPlayers(s.val())));
            unsubs.push(onValue(ref(rtdb, `${base}/hostId`), s => setHostId(s.val())));
            unsubs.push(onValue(ref(rtdb, `${base}/playerIds`), s => setPlayerIds(s.val() ?? [])));
            unsubs.push(onValue(ref(rtdb, `${base}/winner`), s => setWinner(s.val())));
            unsubs.push(onValue(ref(rtdb, `${gs}/currentRound`), s => setCurrentRound(s.val() ?? 1)));
            unsubs.push(onValue(ref(rtdb, `${gs}/scores`), s => setScores(s.val() ?? {})));
            unsubs.push(onValue(ref(rtdb, `${gs}/phase`), s => setPhase(s.val() ?? 'initial')));
            unsubs.push(onValue(ref(rtdb, `${gs}/moves`), s => setMovesState(s.val() ?? {})));
            unsubs.push(onValue(ref(rtdb, `${gs}/roundWinner`), s => setRoundWinner(s.val() ?? null)));
            unsubs.push(onValue(ref(rtdb, `${gs}/roundResultText`), s => setRoundResultText(s.val() ?? '')));
            
            setPlayerOnlineStatus('janken', gameId, user.uid, true);
        });

        return () => {
            unsubs.forEach(u => u());
            if (user) setPlayerOnlineStatus('janken', gameId, user.uid, false);
        };
    }, [gameId, user, router, toast]);

    useEffect(() => {
        if (!players || playerIds.length === 0) return;
        const fetchAllActions = async () => {
            const allActions: { [uid: string]: { [key in Move]?: JankenAction } } = {};
            for (const uid of playerIds) {
                try {
                    allActions[uid] = await getJankenActions(uid);
                } catch (error) {
                    console.error(`Failed to fetch janken actions for user ${uid}`, error);
                }
            }
            setJankenActions(allActions);
        };
        fetchAllActions();
    }, [players, playerIds]);

    const checkWin = (move1: Move, move2: Move) => (
        (move1 === 'rock' && move2 === 'scissors') ||
        (move1 === 'paper' && move2 === 'rock') ||
        (move1 === 'scissors' && move2 === 'paper')
    );

    const nextRound = useCallback(() => {
        if (!isHost || playerIds.length < 2) return;
        const p1Id = playerIds[0];
        const p2Id = playerIds[1];
        update(ref(rtdb, `lobbies/janken/${gameId}/gameState`), {
            currentRound: currentRound + 1,
            phase: 'initial',
            roundWinner: null,
            roundResultText: '',
            moves: {
                [p1Id]: { initial: null, final: null },
                [p2Id]: { initial: null, final: null },
            }
        });
    }, [isHost, gameId, currentRound, playerIds]);

    const evaluateRound = useCallback(() => {
        if (!isHost || !user || !opponentId || !movesState || !players || playerIds.length < 2) return;
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
            resultText = `${players[p2Id].displayName} ${t('wins')}! (${players[p1Id].displayName}'s penalty)`;
            winnerId = p2Id;
        } else if (p2Changed && !checkWin(p2Moves.final, p1Moves.final) && p2Moves.final !== p1Moves.final) {
            resultText = `${players[p1Id].displayName} ${t('wins')}! (${players[p2Id].displayName}'s penalty)`;
            winnerId = p1Id;
        } else if (checkWin(p1Moves.final, p2Moves.final)) {
            resultText = `${players[p1Id].displayName} ${t('wins')}!`;
            winnerId = p1Id;
        } else if (checkWin(p2Moves.final, p1Moves.final)) {
            resultText = `${players[p2Id].displayName} ${t('wins')}!`;
            winnerId = p2Id;
        } else {
            resultText = t('draw');
        }
        
        const newScores = {...scores};
        if (winnerId !== 'draw') {
            newScores[winnerId] = (newScores[winnerId] || 0) + 1;
        }

        update(ref(rtdb, `lobbies/janken/${gameId}/gameState`), {
            scores: newScores,
            roundWinner: winnerId,
            roundResultText: resultText,
            phase: 'result',
        }).then(() => setTimeout(nextRound, 3000));
    }, [isHost, user, opponentId, movesState, players, gameId, t, scores, playerIds, nextRound]);

    useEffect(() => {
        if (!isHost || !user || !opponentId || !movesState || !players) return;
        const myMoves = movesState[user.uid];
        const opponentMoves = movesState[opponentId];

        if (phase === 'initial' && myMoves?.initial && opponentMoves?.initial) {
            update(ref(rtdb, `lobbies/janken/${gameId}/gameState`), { phase: 'final' });
        } else if (phase === 'final' && myMoves?.final && opponentMoves?.final) {
            evaluateRound();
        }
    }, [movesState, phase, isHost, user, opponentId, players, gameId, evaluateRound]);

    const handleSelectMove = async (move: Move) => {
        if (isSubmittingMove || !user || roundWinner || phase === 'result') return;
        const myCurrentMoves = movesState?.[user.uid];
        if (myCurrentMoves && myCurrentMoves[phase]) return;
        setIsSubmittingMove(true);
        try {
            await submitRTDBMove('janken', gameId, user.uid, move, phase);
        } catch (error) {
            console.error("Failed to submit move:", error);
            toast({ title: "Error", description: "Failed to submit move.", variant: "destructive" });
        }
        setIsSubmittingMove(false);
    };

    return {
        gameId,
        loading: status === null,
        error,
        gameState: {
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
        }
    };
}
