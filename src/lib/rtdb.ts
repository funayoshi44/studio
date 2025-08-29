

import { rtdb } from './firebase';
import { ref, set, get, onValue, off, serverTimestamp, runTransaction, onDisconnect, goOffline, goOnline, push } from 'firebase/database';
import type { MockUser, CardData, GameType } from './types';
import { getCards, awardPoints } from './firestore';

// --- Type Definitions for RTDB ---
export interface RTDBGame {
    id: string;
    gameType: GameType;
    players: { [uid: string]: Partial<MockUser> & { online: boolean } };
    playerIds: string[];
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
        moves: {}, lastMoveBy: null, history: {}, roundWinner: null,
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
    const presenceData = { isOnline: true, lastChanged: serverTimestamp() };
    
    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            return;
        }
        onDisconnect(userStatusRef).set({ isOnline: false, lastChanged: serverTimestamp() }).then(() => {
            set(userStatusRef, presenceData);
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

    const result = await runTransaction(lobbyRef, (currentLobby) => {
        if (currentLobby === null) {
            currentLobby = {};
        }

        let suitableGameId: string | null = null;
        for (const gameId in currentLobby) {
            const game: RTDBGame = currentLobby[gameId];
            if (game.status === 'waiting' && game.playerIds.length < game.maxPlayers && !game.playerIds.includes(user.uid)) {
                suitableGameId = gameId;
                break;
            }
        }
        
        if (suitableGameId) {
            // Join existing game
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
            return currentLobby;
        } else {
            // Create new game
            const newGameId = `game_${push(lobbyRef).key}`;
            const newGame: RTDBGame = {
                id: newGameId,
                gameType,
                players: { [user.uid]: { displayName: user.displayName, photoURL: user.photoURL, online: true } },
                playerIds: [user.uid],
                status: 'waiting',
                createdAt: serverTimestamp(),
                maxPlayers: 2,
                gameState: {},
            };
            currentLobby[newGameId] = newGame;
            return currentLobby;
        }
    });

    if(!result.committed) throw new Error("Failed to join or create game.");
    
    // Use the result of the transaction instead of another GET
    const finalLobby = result.snapshot.val();
    for (const gameId in finalLobby) {
        if (finalLobby[gameId].playerIds.includes(user.uid)) {
             awardPoints(user.uid, 1);
             return gameId;
        }
    }
    throw new Error("Could not determine game ID after transaction.");
};


// --- Game Logic for RTDB ---
export const subscribeToRTDBGame = (gameType: GameType, gameId: string, callback: (game: RTDBGame | null) => void): (() => void) => {
    if (!rtdb) return () => {};
    const gameRef = ref(rtdb, `lobbies/${gameType}/${gameId}`);
    onValue(gameRef, (snapshot) => {
        callback(snapshot.val() as RTDBGame | null);
    });

    // Return an unsubscribe function
    return () => off(gameRef);
};

export const updateRTDBGameState = (gameType: GameType, gameId: string, newGameState: any) => {
    if (!rtdb) return;
    const gameStateRef = ref(rtdb, `lobbies/${gameType}/${gameId}/gameState`);
    return set(gameStateRef, newGameState);
};

export const submitRTDBMove = (gameType: GameType, gameId: string, userId: string, move: any, phase?: 'initial' | 'final') => {
    if (!rtdb) return;
    let movePath: string;
    if (gameType === 'janken') {
        if (!phase) throw new Error("Janken move requires a phase.");
        movePath = `lobbies/${gameType}/${gameId}/gameState/moves/${userId}/${phase}`;
    } else {
         // Default for Duel
        movePath = `lobbies/${gameType}/${gameId}/gameState/moves/${userId}`;
    }
    
    const moveRef = ref(rtdb, movePath);
    let moveData = move;
    // For Duel, store lightweight card representation
    if (gameType === 'duel' && move.id) {
        moveData = { id: move.id, suit: move.suit, rank: move.rank, number: move.number };
    }

    return set(moveRef, moveData);
};

export const leaveRTDBGame = async (gameType: GameType, gameId: string, userId: string) => {
    if (!rtdb) return;
    const gameRef = ref(rtdb, `lobbies/${gameType}/${gameId}`);
    await runTransaction(gameRef, (game: RTDBGame | null) => {
        // If game is null, it's already been deleted or doesn't exist.
        if (!game) {
            return game;
        }

        // Remove player if they exist in the game
        if (game.players?.[userId]) {
            delete game.players[userId];
        }

        if (game.playerIds) {
            game.playerIds = game.playerIds.filter(id => id !== userId);
        
            // If game is in progress and only one player remains, they win.
            if (game.status === 'in-progress' && game.playerIds.length === 1) {
                game.status = 'finished';
                game.winner = game.playerIds[0];
            } else if (game.playerIds.length === 0) {
                // If no players left, delete the game from the lobby by returning null.
                return null;
            }
        }

        return game;
    });
};

// Set player online status within a game
export const setPlayerOnlineStatus = (gameType: GameType, gameId: string, userId: string, isOnline: boolean) => {
    if (!rtdb) return;
    const playerStatusRef = ref(rtdb, `lobbies/${gameType}/${gameId}/players/${userId}/online`);
    onDisconnect(playerStatusRef).set(false); // Set to offline on disconnect
    set(playerStatusRef, isOnline);
}
