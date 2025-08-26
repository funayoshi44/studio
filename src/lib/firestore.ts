// import { db } from './firebase';
// import {
//   collection,
//   addDoc,
//   doc,
//   updateDoc,
//   getDoc,
//   onSnapshot,
//   query,
//   where,
//   getDocs,
//   serverTimestamp,
//   Timestamp,
// } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { GameType } from './types';
import type { Timestamp } from 'firebase/firestore';


export interface Game {
  id: string;
  gameType: GameType;
  players: { [uid: string]: { displayName: string; photoURL: string } };
  playerIds: string[];
  status: 'waiting' | 'in-progress' | 'finished';
  createdAt: Timestamp;
  gameState: any;
  winner?: string | null; // UID of the winner
}

// Create a new game
export const createGame = async (user: User, gameType: GameType): Promise<string> => {
  // const gameCollection = collection(db, 'games');
  // const docRef = await addDoc(gameCollection, {
  //   gameType,
  //   players: {
  //     [user.uid]: {
  //       displayName: user.displayName,
  //       photoURL: user.photoURL,
  //     },
  //   },
  //   playerIds: [user.uid],
  //   status: 'waiting',
  //   createdAt: serverTimestamp(),
  //   gameState: {},
  // });
  // return docRef.id;
  return Promise.resolve("dummy-game-id");
};

// Join a game
export const joinGame = async (gameId: string, user: User): Promise<void> => {
  // const gameRef = doc(db, 'games', gameId);
  // const gameSnap = await getDoc(gameRef);

  // if (gameSnap.exists()) {
  //   const gameData = gameSnap.data() as Game;
  //   if (gameData.playerIds.length < 2 && !gameData.playerIds.includes(user.uid)) {
  //     await updateDoc(gameRef, {
  //       [`players.${user.uid}`]: {
  //         displayName: user.displayName,
  //         photoURL: user.photoURL,
  //       },
  //       playerIds: [...gameData.playerIds, user.uid],
  //       status: 'in-progress',
  //     });
  //   }
  // } else {
  //   throw new Error('Game not found');
  // }
};

// Listen for game updates
export const subscribeToGame = (gameId: string, callback: (game: Game | null) => void) => {
  // const gameRef = doc(db, 'games', gameId);
  // return onSnapshot(gameRef, (docSnap) => {
  //   if (docSnap.exists()) {
  //     callback({ id: docSnap.id, ...docSnap.data() } as Game);
  //   } else {
  //     callback(null);
  //   }
  // });
  return () => {}; // return dummy unsubscribe function
};

// Update game state
export const updateGameState = async (gameId: string, newGameState: any): Promise<void> => {
  // const gameRef = doc(db, 'games', gameId);
  // await updateDoc(gameRef, { gameState: newGameState });
};

// Submit a move
export const submitMove = async (gameId: string, userId: string, move: any) => {
    // const gameRef = doc(db, 'games', gameId);
    // await updateDoc(gameRef, {
    //     [`gameState.moves.${userId}`] : move,
    //     'gameState.lastMoveBy': userId,
    // });
};


// Find available games
export const findAvailableGames = async (gameType: GameType): Promise<Game[]> => {
  // const gamesCollection = collection(db, 'games');
  // const q = query(
  //   gamesCollection,
  //   where('gameType', '==', gameType),
  //   where('status', '==', 'waiting')
  // );
  // const querySnapshot = await getDocs(q);
  // const games: Game[] = [];
  // querySnapshot.forEach((doc) => {
  //   games.push({ id: doc.id, ...doc.data() } as Game);
  // });
  // return games;
  return Promise.resolve([]);
};
