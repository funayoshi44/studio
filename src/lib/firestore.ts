
import { db } from './firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit,
  runTransaction,
  orderBy,
} from 'firebase/firestore';
import type { GameType } from './types';


export interface Game {
  id: string;
  gameType: GameType;
  players: { [uid: string]: { displayName: string | null; photoURL: string | null } };
  playerIds: string[];
  status: 'waiting' | 'in-progress' | 'finished';
  createdAt: Timestamp;
  gameState: any;
  winner?: string | null; // UID of the winner
}

export interface Message {
  id: string;
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  text: string;
  createdAt: Timestamp;
}

// Create a new game
export const createGame = async (user: {uid: string; displayName: string | null; photoURL: string | null}, gameType: GameType): Promise<string> => {
  const gameCollection = collection(db, 'games');
  const docRef = await addDoc(gameCollection, {
    gameType,
    players: {
      [user.uid]: {
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    },
    playerIds: [user.uid],
    status: 'waiting',
    createdAt: serverTimestamp(),
    gameState: {},
  });
  return docRef.id;
};

// Join a game
export const joinGame = async (gameId: string, user: {uid: string; displayName: string | null; photoURL: string | null}): Promise<void> => {
    const gameRef = doc(db, 'games', gameId);

    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);

        if (!gameSnap.exists()) {
            throw new Error('Game not found');
        }

        const gameData = gameSnap.data() as Game;
        if (gameData.playerIds.length >= 2 || gameData.playerIds.includes(user.uid)) {
            throw new Error('Game is full or you are already in it');
        }
        
        // Initialize game state when the second player joins
        const p1 = gameData.playerIds[0];
        const p2 = user.uid;
        const TOTAL_ROUNDS = 13; // Specific to Duel
        
        const initialGameStateForJoin = {
          ...initialDuelGameState,
          playerHands: {
              [p1]: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1),
              [p2]: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)
          },
          scores: { [p1]: 0, [p2]: 0 },
          kyuso: { [p1]: 0, [p2]: 0 },
          only: { [p1]: 0, [p2]: 0 },
          moves: { [p1]: null, [p2]: null },
        };

        transaction.update(gameRef, {
            [`players.${user.uid}`]: {
                displayName: user.displayName,
                photoURL: user.photoURL,
            },
            playerIds: [...gameData.playerIds, user.uid],
            status: 'in-progress',
            gameState: initialGameStateForJoin,
        });
    });
};


// Listen for game updates
export const subscribeToGame = (gameId: string, callback: (game: Game | null) => void) => {
  const gameRef = doc(db, 'games', gameId);
  return onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Game);
    } else {
      callback(null);
    }
  });
};

// Update game state
export const updateGameState = async (gameId: string, newGameState: any): Promise<void> => {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, { gameState: newGameState });
};

// Submit a move
export const submitMove = async (gameId: string, userId: string, move: any) => {
    const gameRef = doc(db, 'games', gameId);
    await runTransaction(db, async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      if (!gameDoc.exists()) {
        throw "Document does not exist!";
      }
      const currentGameState = gameDoc.data().gameState || {};
      const newMoves = { ...currentGameState.moves, [userId]: move };
      const newGameState = {
        ...currentGameState,
        moves: newMoves,
        lastMoveBy: userId,
      };
      transaction.update(gameRef, { gameState: newGameState });
    });
};


// Find available games
export const findAvailableGames = async (): Promise<Game[]> => {
  const gamesCollection = collection(db, 'games');
  const q = query(
    gamesCollection,
    where('status', '==', 'waiting'),
    limit(20)
  );
  const querySnapshot = await getDocs(q);
  const games: Game[] = [];
  querySnapshot.forEach((doc) => {
    games.push({ id: doc.id, ...doc.data() } as Game);
  });
  return games;
};

const initialDuelGameState = {
  currentRound: 1,
  playerHands: {},
  scores: {},
  kyuso: {},
  only: {},
  moves: {},
  lastMoveBy: null,
  history: {},
  roundWinner: null,
  roundResultText: '',
  roundResultDetail: '',
};

// --- Auto Matchmaking ---
export const findAndJoinGame = async (user: {uid: string; displayName: string | null; photoURL: string | null}, gameType: GameType): Promise<string> => {
  const gamesRef = collection(db, 'games');
  
  return runTransaction(db, async (transaction) => {
    // Query for a waiting game of the correct type that the user is not already in.
    const q = query(
        gamesRef,
        where('gameType', '==', gameType),
        where('status', '==', 'waiting'),
        limit(10)
      );

    const querySnapshot = await getDocs(q);
    
    let suitableGame: Game | null = null;
    let suitableGameId: string | null = null;
    
    // Find a game the user is not part of
    for (const doc of querySnapshot.docs) {
        const game = { id: doc.id, ...doc.data() } as Game;
        if (!game.playerIds.includes(user.uid)) {
            suitableGame = game;
            suitableGameId = doc.id;
            break;
        }
    }

    if (suitableGame && suitableGameId) {
      // Found a game, join it
      const gameRef = doc(db, 'games', suitableGameId);
      const p1 = suitableGame.playerIds[0];
      const p2 = user.uid;
      const TOTAL_ROUNDS = 13;
      
      const initialGameStateForJoin = {
          ...initialDuelGameState,
          playerHands: {
              [p1]: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1),
              [p2]: Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)
          },
          scores: { [p1]: 0, [p2]: 0 },
          kyuso: { [p1]: 0, [p2]: 0 },
          only: { [p1]: 0, [p2]: 0 },
          moves: { [p1]: null, [p2]: null },
      };

      transaction.update(gameRef, {
        [`players.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        playerIds: [...suitableGame.playerIds, user.uid],
        status: 'in-progress',
        gameState: initialGameStateForJoin,
      });
      return suitableGameId;
    } else {
      // No suitable waiting games found, create a new one
      const newGameRef = doc(collection(db, "games"));
      
      transaction.set(newGameRef, {
        gameType,
        players: {
          [user.uid]: {
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
        },
        playerIds: [user.uid],
        status: 'waiting',
        createdAt: serverTimestamp(),
        gameState: {},
      });
      return newGameRef.id;
    }
  });
};

// Send a message in a game chat
export const sendMessage = async (gameId: string, message: Omit<Message, 'id' | 'createdAt'>) => {
  const messagesCol = collection(db, 'games', gameId, 'messages');
  await addDoc(messagesCol, {
    ...message,
    createdAt: serverTimestamp(),
  });
};

// Listen for messages in a game chat
export const subscribeToMessages = (gameId: string, callback: (messages: Message[]) => void) => {
  const messagesCol = collection(db, 'games', gameId, 'messages');
  const q = query(messagesCol, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(q, (querySnapshot) => {
    const messages: Message[] = [];
    querySnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as Message);
    });
    callback(messages);
  });
};

// Forfeit a game
export const leaveGame = async (gameId: string, leavingPlayerId: string): Promise<void> => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) {
                console.log("Game not found, can't leave.");
                return;
            }

            const gameData = gameSnap.data() as Game;

            // Don't do anything if game is already finished
            if (gameData.status === 'finished') {
                return;
            }

            const winnerId = gameData.playerIds.find(p => p !== leavingPlayerId) || null;

            transaction.update(gameRef, {
                status: 'finished',
                winner: winnerId,
            });
        });
    } catch (error) {
        console.error("Failed to leave game:", error);
    }
};
    
