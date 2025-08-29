
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/components/ui/toast';
import { onValue, ref, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { setupPresence, teardownPresence, setPlayerOnlineStatus, submitRTDBMove } from '@/lib/rtdb';
import { useCardCache } from '@/contexts/card-cache-context';
import type { CardData } from '@/lib/types';
import { useTranslation } from './use-translation';

type PlayerHand = Omit<CardData, 'title' | 'caption' | 'frontImageUrl' | 'backImageUrl'>[];
type LightCard = { id: string; suit: string; rank: number | string; number: number; };

const TOTAL_ROUNDS = 13;

export function useDuelGame() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const gameId = params.gameId as string;
    const { toast } = useToast();
    const { cards: allCards, loading: cardsLoading } = useCardCache();
    const cardMap = useMemo(() => new Map(allCards.map(c => [c.id, c])), [allCards]);
    const { t } = useTranslation();

    const [status, setStatus] = useState<'waiting' | 'in-progress' | 'finished' | null>(null);
    const [players, setPlayers] = useState<any>(null);
    const [playerIds, setPlayerIds] = useState<string[]>([]);
    const [winner, setWinner] = useState<string | 'draw' | null | undefined>(null);
    const [currentRound, setCurrentRound] = useState(1);
    const [scores, setScores] = useState<{ [uid: string]: number }>({});
    const [kyuso, setKyuso] = useState<{ [uid: string]: number }>({});
    const [only, setOnly] = useState<{ [uid: string]: number }>({});
    const [moves, setMoves] = useState<{ [uid: string]: LightCard | null }>({});
    const [roundWinner, setRoundWinner] = useState<string | null | 'draw'>(null);
    const [roundResultText, setRoundResultText] = useState('');
    const [roundResultDetail, setRoundResultDetail] = useState('');
    const [playerHands, setPlayerHands] = useState<{ [uid: string]: PlayerHand }>({});
    
    const [isSubmittingMove, setIsSubmittingMove] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const opponentId = useMemo(() => playerIds.find(p => p !== user?.uid), [playerIds, user]);
    const isHost = useMemo(() => user && playerIds.length > 0 && playerIds[0] === user.uid, [user, playerIds]);

    const rehydrateCard = useCallback((lightCard: LightCard | null): CardData | null => {
        if (!lightCard) return null;
        const fullCard = cardMap.get(lightCard.id);
        return fullCard ? { ...fullCard, ...lightCard } : null;
    }, [cardMap]);

    useEffect(() => {
        if (user) {
            setupPresence(user.uid);
        }
        return () => {
            teardownPresence();
        }
    }, [user]);

    useEffect(() => {
        if (!gameId || !user) return;
        
        const base = `lobbies/duel/${gameId}`;
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
            unsubs.push(onValue(ref(rtdb, `${base}/winner`), s => setWinner(s.val())));
            unsubs.push(onValue(ref(rtdb, `${gs}/currentRound`), s => setCurrentRound(s.val() ?? 1)));
            unsubs.push(onValue(ref(rtdb, `${gs}/scores`), s => setScores(s.val() ?? {})));
            unsubs.push(onValue(ref(rtdb, `${gs}/kyuso`), s => setKyuso(s.val() ?? {})));
            unsubs.push(onValue(ref(rtdb, `${gs}/only`), s => setOnly(s.val() ?? {})));
            unsubs.push(onValue(ref(rtdb, `${gs}/roundWinner`), s => setRoundWinner(s.val() ?? null)));
            unsubs.push(onValue(ref(rtdb, `${gs}/roundResultText`), s => setRoundResultText(s.val() ?? '')));
            unsubs.push(onValue(ref(rtdb, `${gs}/roundResultDetail`), s => setRoundResultDetail(s.val() ?? '')));
            unsubs.push(onValue(ref(rtdb, `${gs}/playerHands/${user.uid}`), s => setPlayerHands(prev => ({ ...prev, [user.uid]: s.val() ?? [] }))));
            unsubs.push(onValue(ref(rtdb, `${gs}/moves/${user.uid}`), s => setMoves(prev => ({ ...prev, [user.uid]: s.val() ?? null }))));
            
            let oppUnsub: (() => void) | null = null;
            const attachOpponentListener = (oppId?: string) => {
                if (oppUnsub) { oppUnsub(); oppUnsub = null; }
                if (!oppId) return;
                oppUnsub = onValue(ref(rtdb, `${gs}/moves/${oppId}`), s => setMoves(prev => ({ ...prev, [oppId]: s.val() ?? null })));
                unsubs.push(() => oppUnsub && oppUnsub());
            };
            
            const playerIdsUnsub = onValue(ref(rtdb, `${base}/playerIds`), snap => {
                const ids = snap.val() || [];
                setPlayerIds(ids);
                const currentOpponent = ids.find((p: string) => p !== user.uid);
                attachOpponentListener(currentOpponent);
            });
            unsubs.push(playerIdsUnsub);

            setPlayerOnlineStatus('duel', gameId, user.uid, true);
        });

        return () => {
            unsubs.forEach(unsubscribe => unsubscribe());
            if (user) {
                setPlayerOnlineStatus('duel', gameId, user.uid, false);
            }
        };
    }, [gameId, user, router, toast]);

    const checkGameEnd = useCallback((currentScores: any, currentKyuso: any, currentOnly: any) => {
        if (!user || !opponentId || !isHost) return;

        const p1Id = playerIds[0];
        const p2Id = playerIds[1];
        let ended = false;
        let finalWinnerId: string | 'draw' | null = null;
        
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
            update(ref(rtdb), { [`lobbies/duel/${gameId}/status`]: 'finished', [`lobbies/duel/${gameId}/winner`]: finalWinnerId });
        } else {
            update(ref(rtdb, `lobbies/duel/${gameId}/gameState`), {
                currentRound: currentRound + 1,
                moves: { [p1Id]: null, [p2Id]: null },
                roundWinner: null,
                roundResultText: '',
                roundResultDetail: '',
            });
        }
    }, [user, opponentId, isHost, playerIds, currentRound, gameId]);

    const evaluateRound = useCallback(() => {
        if (!user || !opponentId || !players) return;

        let winnerId: string | 'draw' = 'draw';
        let resultText = '';
        let resultDetail = '';
        let winType = '';
        
        const newScores = { ...scores };
        const newKyuso = { ...kyuso };
        const newOnly = { ...only };
        
        const myCard = rehydrateCard(moves[user.uid]);
        const opponentCard = rehydrateCard(moves[opponentId]);
        
        if (!myCard || !opponentCard) return;

        if (myCard.number === 1 && opponentCard.number === 13) { winnerId = user.uid; winType = 'only'; }
        else if (opponentCard.number === 1 && myCard.number === 13) { winnerId = opponentId; winType = 'only'; }
        else if (myCard.number === opponentCard.number - 1) { winnerId = user.uid; winType = 'kyuso'; }
        else if (opponentCard.number === myCard.number - 1) { winnerId = opponentId; winType = 'kyuso'; }
        else if (myCard.number > opponentCard.number) { winnerId = user.uid; }
        else if (opponentCard.number > myCard.number) { winnerId = opponentId; }

        if (winnerId !== 'draw') {
            newScores[winnerId] = (newScores[winnerId] || 0) + 1;
            if (winType === 'only') { newOnly[winnerId] = (newOnly[winnerId] || 0) + 1; resultDetail = t('duelResultOnlyOne'); }
            else if (winType === 'kyuso') { newKyuso[winnerId] = (newKyuso[winnerId] || 0) + 1; resultDetail = t('duelResultKyuso'); }
        }
        
        resultText = winnerId === 'draw' ? t('draw') : `${players[winnerId]?.displayName ?? 'Player'} ${t('wins')}!`;
        if (!resultDetail) resultDetail = `${players[user.uid]?.displayName ?? 'You'}: ${myCard.number} vs ${players[opponentId]?.displayName ?? 'Opponent'}: ${opponentCard.number}`;

        const myNewHand = (playerHands[user.uid] || []).filter((c: any) => c.id !== myCard.id);

        const updates: any = {};
        const gsPath = `lobbies/duel/${gameId}/gameState`;
        updates[`${gsPath}/scores`] = newScores;
        updates[`${gsPath}/kyuso`] = newKyuso;
        updates[`${gsPath}/only`] = newOnly;
        updates[`${gsPath}/playerHands/${user.uid}`] = myNewHand;
        updates[`${gsPath}/roundWinner`] = winnerId;
        updates[`${gsPath}/roundResultText`] = resultText;
        updates[`${gsPath}/roundResultDetail`] = resultDetail;
        
        update(ref(rtdb), updates).then(() => {
            setTimeout(() => checkGameEnd(newScores, newKyuso, newOnly), 2000);
        });
    }, [user, opponentId, players, scores, kyuso, only, moves, playerHands, gameId, t, rehydrateCard, checkGameEnd]);

    useEffect(() => {
        if (!user || !opponentId || !isHost) return;
        const myMove = moves?.[user.uid];
        const opponentMove = moves?.[opponentId];
        if (myMove != null && opponentMove != null && roundWinner === null) {
            evaluateRound();
        }
    }, [moves, user, opponentId, isHost, roundWinner, evaluateRound]);

    const handleSelectCard = async (card: CardData) => {
        if (isSubmittingMove || !user) return;
        if (moves?.[user.uid]) return;
        setIsSubmittingMove(true);
        try {
            await submitRTDBMove('duel', gameId, user.uid, card);
        } catch (err) {
            console.error("Failed to submit move:", err);
            toast({ title: "Error", description: "Failed to submit move.", variant: 'destructive' });
        }
        setIsSubmittingMove(false);
    };

    const myLightHand = playerHands?.[user?.uid ?? ''] ?? [];
    const myFullHand = useMemo(() => myLightHand.map(rehydrateCard).filter((c): c is CardData => c !== null), [myLightHand, rehydrateCard]);

    return {
        gameId,
        loading: status === null || cardsLoading,
        error,
        gameState: {
            status,
            players,
            playerIds,
            winner,
            currentRound,
            scores,
            kyuso,
            only,
            moves: useMemo(() => ({
                [user?.uid ?? '']: rehydrateCard(moves[user?.uid ?? '']),
                ...(opponentId && { [opponentId]: rehydrateCard(moves[opponentId]) })
            }), [moves, user?.uid, opponentId, rehydrateCard]),
            roundWinner,
            roundResultText,
            roundResultDetail,
            myFullHand,
            handleSelectCard,
            isSubmittingMove,
        }
    };
}
