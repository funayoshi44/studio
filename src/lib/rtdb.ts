
import { rtdb } from './firebase';
import { ref, set, get, onValue, off, serverTimestamp, runTransaction, onDisconnect, goOffline, goOnline, push, update } from 'firebase/database';
import type { MockUser, CardData, GameType, Game } from './types';
import { getCards, awardPoints } from './firestore';

// --- Type Definitions for RTDB ---
export interface RTDBGame {
    id: string;
    gameType: GameType;
    players: { [uid: string]: Partial<MockUser> & { online: boolean } };
    playerIds: string[];
    hostId: string;
    status: 'waiting' | 'in-progress' | 'finished';
    createdAt: object;
    maxPlayers: number;
    gameState: any;
    winner?: string | 'draw' | null;
}

const createDefaultDeck = (count = 13): CardData[] => {
    return Array.from({ length: count }, (_, i) => {
        const rank = i + 1;
        return {
            id: `default-${rank}`,
            frontImageUrl: `https://picsum.photos/seed/card-default-${rank}/200/300`,
            backImageUrl: null,
            suit: 'default',
            rank: rank,
            title: `Default Card ${rank}`,
            caption: `This is a default card. Number ${rank}.`,
            hashtags: ['default'],
            seriesName: 'Default Series',
            authorName: 'System',
            authorId: 'system',
            createdAt: new Date() as any,
            updatedAt: new Date() as any,
            number: rank,
            value: rank,
            name: `Default Card ${rank}`,
            artist: 'System',
            imageUrl: `https://picsum.photos/seed/card-default-${rank}/200/300`,
            rarity: 'common',
            tags: ['default'],
            gameType: 'common',
        };
    });
};

const createRandomDeck = (allCards: CardData[]): CardData[] => {
    let deck = [...allCards];
    if (deck.length < 13) {
        const needed = 13 - deck.length;
        const defaultCards = createDefaultDeck(13);
        const uniqueDefaults = defaultCards.filter(dc => !deck.some(rc => rc.number === dc.number));
        deck.push(...uniqueDefaults.slice(0, needed));
    }
    const shuffled = deck.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 13);
};

const getInitialDuelGameState = (allCards: CardData[], playerIds: string[] = []) => {
    const gameState: any = {
        currentRound: 1, playerHands: {}, scores: {}, kyuso: {}, only: {},
        moves: {}, roundWinner: null,
        roundResultText: '', roundResultDetail: '',
    };
    playerIds.forEach(uid => {
        // Store lightweight card representation in RTDB
        gameState.playerHands[uid] = createRandomDeck(allCards).map(c => ({ id: c.id, suit: c.suit, rank: c.rank, number: c.number }));
        gameState.scores[uid] = 0;
        gameState.kyuso[uid] = 0;
        gameState.only[uid] = 0;
        gameState.moves[uid] = null;
    });
    return gameState;
};

const getInitialJankenGameState = (playerIds: string[] = []) => {
    const gameState: any = {
        currentRound: 1,
        scores: {},
        moves: {}, // { uid: { initial: null, final: null } }
        phase: 'initial', // 'initial', 'final', 'result'
        roundWinner: null,
        roundResultText: '',
    };
    playerIds.forEach(uid => {
        gameState.scores[uid] = 0;
        gameState.moves[uid] = { initial: null, final: null };
    });
    return gameState;
};


// --- User Presence System ---
export const setupPresence = (userId: string) => {
    if (!rtdb) return;
    goOnline(rtdb);
    const userStatusRef = ref(rtdb, `/status/${userId}`);
    const isOnlineData = { isOnline: true, lastChanged: serverTimestamp() };
    const isOfflineData = { isOnline: false, lastChanged: serverTimestamp() };
    
    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
             set(userStatusRef, isOfflineData);
            return;
        }
        onDisconnect(userStatusRef).set(isOfflineData).then(() => {
            set(userStatusRef, isOnlineData);
        });
    });
};

export const teardownPresence = () => {
    if (!rtdb) return;
    goOffline(rtdb);
}

// --- Game Lobby & Matchmaking for RTDB ---
export const findAndJoinRTDBGame = async (user: MockUser, gameType: GameType): Promise<string> => {
    if (!rtdb) throw new Error("Realtime Database not initialized");
    const lobbyRef = ref(rtdb, `lobbies/${gameType}`);
    const allCards = await getCards();
    let gameIdToReturn: string | null = null;

    const result = await runTransaction(lobbyRef, (currentLobby) => {
        if (currentLobby === null) {
            currentLobby = {};
        }

        let suitableGameId: string | null = null;
        for (const gameId in currentLobby) {
            const game: RTDBGame = currentLobby[gameId];
            if (game.status === 'waiting' && game.playerIds && game.playerIds.length < game.maxPlayers && !game.playerIds.includes(user.uid)) {
                suitableGameId = gameId;
                break;
            }
        }
        
        if (suitableGameId) {
            const game = currentLobby[suitableGameId];
            game.playerIds.push(user.uid);
            game.players[user.uid] = { displayName: user.displayName, photoURL: user.photoURL, online: true };
            if (game.playerIds.length === game.maxPlayers) {
                game.status = 'in-progress';
                if(game.gameType === 'duel') {
                    game.gameState = getInitialDuelGameState(allCards, game.playerIds);
                } else if(game.gameType === 'janken') {
                    game.gameState = getInitialJankenGameState(game.playerIds);
                }
            }
            gameIdToReturn = suitableGameId;
            return currentLobby;
        } else {
            const newGameKey = push(lobbyRef).key;
            if (!newGameKey) throw new Error("Could not generate a new game key.");
            const newGame: RTDBGame = {
                id: newGameKey,
                gameType,
                hostId: user.uid,
                players: { [user.uid]: { displayName: user.displayName, photoURL: user.photoURL, online: true } },
                playerIds: [user.uid],
                status: 'waiting',
                createdAt: serverTimestamp(),
                maxPlayers: gameType === 'poker' ? 4 : 2,
                gameState: {},
            };
            currentLobby[newGameKey] = newGame;
            gameIdToReturn = newGameKey;
            return currentLobby;
        }
    });

    if(!result.committed || !gameIdToReturn) throw new Error("Failed to join or create game.");
    
    await awardPoints(user.uid, 1);
    return gameIdToReturn;
};


export const submitRTDBMove = (gameType: GameType, gameId: string, userId: string, move: any, phase?: 'initial' | 'final') => {
    if (!rtdb) return;
    let movePath: string;
    if (gameType === 'janken') {
        if (!phase) throw new Error("Janken move requires a phase.");
        movePath = `lobbies/${gameType}/${gameId}/gameState/moves/${userId}/${phase}`;
    } else {
        movePath = `lobbies/${gameType}/${gameId}/gameState/moves/${userId}`;
    }
    
    const moveRef = ref(rtdb, movePath);
    let moveData = move;
    if (gameType === 'duel' && move.id) {
        moveData = { id: move.id, suit: move.suit, rank: move.rank, number: move.number };
    }

    return set(moveRef, moveData);
};

export const leaveRTDBGame = async (gameType: GameType, gameId: string, userId: string) => {
    if (!rtdb) return;
    const gameRef = ref(rtdb, `lobbies/${gameType}/${gameId}`);
    await runTransaction(gameRef, (game: RTDBGame | null) => {
        if (!game) {
            return game;
        }
        if (game.players?.[userId]) {
            delete game.players[userId];
        }

        if (game.playerIds) {
            game.playerIds = game.playerIds.filter(id => id !== userId);
            if (game.status === 'in-progress' && game.playerIds.length < 2) {
                game.status = 'finished';
                game.winner = game.playerIds[0] || 'draw'; // The remaining player wins
            } else if (game.playerIds.length === 0) {
                return null;
            }
        }
        return game;
    });
};

export const setPlayerOnlineStatus = (gameType: GameType, gameId: string, userId: string, isOnline: boolean) => {
    if (!rtdb) return;
    const playerStatusRef = ref(rtdb, `lobbies/${gameType}/${gameId}/players/${userId}/online`);
    onDisconnect(playerStatusRef).set(false);
    set(playerStatusRef, isOnline);
}

export const subscribeToLobbies = (gameType: GameType, callback: (lobbies: any[]) => void) => {
    const lobbiesRef = ref(rtdb, `lobbies/${gameType}`);
    const unsubscribe = onValue(lobbiesRef, (snapshot) => {
        const lobbiesData = snapshot.val();
        const lobbiesArray = lobbiesData ? Object.keys(lobbiesData).map(key => ({ id: key, ...lobbiesData[key] })) : [];
        callback(lobbiesArray);
    });
    return () => unsubscribe();
};

export const subscribeToOnlineUsers = (callback: (users: any[]) => void) => {
    const onlineUsersRef = ref(rtdb, 'status');
    const unsubscribe = onValue(onlineUsersRef, (snapshot) => {
        const usersData = snapshot.val();
        const usersArray = usersData ? Object.keys(usersData)
            .filter(uid => usersData[uid].isOnline)
            .map(uid => ({ uid, ...usersData[uid] })) : [];
        callback(usersArray);
    });
    return () => unsubscribe();
};


export const getUserGameHistory = async (userId: string): Promise<Game[]> => {
    if (!rtdb) return [];
    
    const allGames: Game[] = [];
    const gameTypes: GameType[] = ['duel', 'janken']; // Poker not included yet

    for (const gameType of gameTypes) {
        const gamesRef = ref(rtdb, `lobbies/${gameType}`);
        const snapshot = await get(gamesRef);
        if (snapshot.exists()) {
            const gamesData = snapshot.val();
            for (const gameId in gamesData) {
                const game = gamesData[gameId] as Game;
                if (game.playerIds?.includes(userId) && game.status === 'finished') {
                    allGames.push({ id: gameId, ...game });
                }
            }
        }
    }
    
    const toMs = (timestamp: any): number => (typeof timestamp === 'number' ? timestamp : 0);
    
    allGames.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

    return allGames.slice(0, 50); // Limit to 50 most recent games
};
