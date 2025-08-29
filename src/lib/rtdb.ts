
import { rtdb } from './firebase';
import { ref, set, get, onValue, off, serverTimestamp, runTransaction, onDisconnect, goOffline, goOnline } from 'firebase/database';
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
        gameState.playerHands[uid] = createRandomDeck(allCards);
        gameState.scores[uid] = 0;
        gameState.kyuso[uid] = 0;
        gameState.only[uid] = 0;
        gameState.moves[uid] = null;
    });
    return gameState;
};


// --- User Presence System ---
export const setupPresence = (userId: string) => {
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
    goOffline(rtdb);
}

// --- Game Lobby & Matchmaking for RTDB ---
export const findAndJoinRTDBGame = async (user: MockUser, gameType: GameType): Promise<string> => {
    const lobbyRef = ref(rtdb, `lobbies/${gameType}`);
    const allCards = await getCards();

    return runTransaction(lobbyRef, (currentLobby) => {
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
                }
                // TODO: Add logic for other game types
            }
            return currentLobby;
        } else {
            // Create new game
            const newGameId = `game_${Date.now()}`;
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
    }).then(async (result) => {
        if(!result.committed) throw new Error("Failed to join or create game.");
        // After transaction, find which game we are in
        const finalLobby = (await get(lobbyRef)).val();
        for (const gameId in finalLobby) {
            if (finalLobby[gameId].playerIds.includes(user.uid)) {
                 await awardPoints(user.uid, 1);
                 return gameId;
            }
        }
        throw new Error("Could not determine game ID after transaction.");
    });
};

// --- Game Logic for RTDB ---
export const subscribeToRTDBGame = (gameType: GameType, gameId: string, callback: (game: RTDBGame | null) => void) => {
    const gameRef = ref(rtdb, `lobbies/${gameType}/${gameId}`);
    onValue(gameRef, (snapshot) => {
        callback(snapshot.val() as RTDBGame | null);
    });

    // Return an unsubscribe function
    return () => off(gameRef);
};

export const updateRTDBGameState = (gameType: GameType, gameId: string, newGameState: any) => {
    const gameStateRef = ref(rtdb, `lobbies/${gameType}/${gameId}/gameState`);
    return set(gameStateRef, newGameState);
};

export const submitRTDBMove = (gameType: GameType, gameId: string, userId: string, move: CardData) => {
    const moveRef = ref(rtdb, `lobbies/${gameType}/${gameId}/gameState/moves/${userId}`);
    const lastMoveByRef = ref(rtdb, `lobbies/${gameType}/${gameId}/gameState/lastMoveBy`);
    set(moveRef, move);
    set(lastMoveByRef, userId);
};

export const leaveRTDBGame = async (gameType: GameType, gameId: string, userId: string) => {
    const gameRef = ref(rtdb, `lobbies/${gameType}/${gameId}`);
    await runTransaction(gameRef, (game: RTDBGame) => {
        if (!game) return;

        // Remove player
        if (game.players[userId]) {
            delete game.players[userId];
        }
        game.playerIds = game.playerIds.filter(id => id !== userId);
        
        // If game is in progress and only one player remains, they win.
        if (game.status === 'in-progress' && game.playerIds.length === 1) {
            game.status = 'finished';
            game.winner = game.playerIds[0];
            awardPoints(game.winner!, 1);
        } else if (game.playerIds.length === 0) {
            // If no players left, delete the game from the lobby
            return null;
        }

        return game;
    });
};

// Set player online status within a game
export const setPlayerOnlineStatus = (gameType: GameType, gameId: string, userId: string, isOnline: boolean) => {
    const playerStatusRef = ref(rtdb, `lobbies/${gameType}/${gameId}/players/${userId}/online`);
    onDisconnect(playerStatusRef).set(false); // Set to offline on disconnect
    set(playerStatusRef, isOnline);
}
