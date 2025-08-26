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
  const gameSnap = await getDoc(gameRef);

  if (gameSnap.exists()) {
    const gameData = gameSnap.data() as Game;
    if (gameData.playerIds.length < 2 && !gameData.playerIds.includes(user.uid)) {
      await updateDoc(gameRef, {
        [`players.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        playerIds: [...gameData.playerIds, user.uid],
        status: 'in-progress',
      });
    }
  } else {
    throw new Error('Game not found');
  }
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
    await updateDoc(gameRef, {
        [`gameState.moves.${userId}`] : move,
        'gameState.lastMoveBy': userId,
    });
};


// Find available games
export const findAvailableGames = async (gameType: GameType): Promise<Game[]> => {
  const gamesCollection = collection(db, 'games');
  const q = query(
    gamesCollection,
    where('gameType', '==', gameType),
    where('status', '==', 'waiting')
  );
  const querySnapshot = await getDocs(q);
  const games: Game[] = [];
  querySnapshot.forEach((doc) => {
    games.push({ id: doc.id, ...doc.data() } as Game);
  });
  return games;
};

// --- Auto Matchmaking ---
export const findAndJoinGame = async (user: {uid: string; displayName: string | null; photoURL: string | null}, gameType: GameType): Promise<string> => {
  const gamesRef = collection(db, 'games');
  // Query for a waiting game of the correct type that the user is not already in.
  const q = query(
    gamesRef,
    where('gameType', '==', gameType),
    where('status', '==', 'waiting'),
    where('playerIds', '!=', [user.uid]), // This is a workaround since 'not-in' is not supported for array membership in this way
    limit(1)
  );

  return runTransaction(db, async (transaction) => {
    const querySnapshot = await getDocs(q);
    let suitableGame: Game | null = null;
    let suitableGameId: string | null = null;

    // Filter out games the user is already in client-side
    querySnapshot.forEach(doc => {
      const game = { id: doc.id, ...doc.data() } as Game;
      if (!game.playerIds.includes(user.uid)) {
        suitableGame = game;
        suitableGameId = doc.id;
      }
    });

    if (suitableGame && suitableGameId) {
      // Found a game, join it
      const gameRef = doc(db, 'games', suitableGameId);
      transaction.update(gameRef, {
        [`players.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        playerIds: [...suitableGame.playerIds, user.uid],
        status: 'in-progress',
      });
      return suitableGameId;
    } else {
      // No waiting games found, create a new one
      const newGameRef = doc(collection(db, "games")); // Create a new ref with an auto-generated ID
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
