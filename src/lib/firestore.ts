

import { db, storage } from './firebase';
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
  deleteDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Game, GameType, MockUser, Post, CardData, Message } from './types';


const TOTAL_ROUNDS = 13;

const getInitialDuelGameState = (playerIds: string[] = []) => {
    const gameState: any = {
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
    playerIds.forEach(uid => {
        gameState.playerHands[uid] = Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1);
        gameState.scores[uid] = 0;
        gameState.kyuso[uid] = 0;
        gameState.only[uid] = 0;
        gameState.moves[uid] = null;
    });
    return gameState;
};


// Upload a profile image and get the URL
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `profileImages/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

// Create a new game
export const createGame = async (user: MockUser, gameType: GameType): Promise<string> => {
  const gameCollection = collection(db, 'games');
  
  const docRef = await addDoc(gameCollection, {
    gameType,
    players: {
      [user.uid]: {
        displayName: user.displayName,
        photoURL: user.photoURL,
        bio: user.bio || '',
      },
    },
    playerIds: [user.uid],
    status: 'waiting',
    createdAt: serverTimestamp(),
    gameState: gameType === 'duel' ? getInitialDuelGameState([user.uid]) : {},
  });
  return docRef.id;
};

// Join a game
export const joinGame = async (gameId: string, user: MockUser): Promise<void> => {
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
        
        const newPlayerIds = [...gameData.playerIds, user.uid];

        transaction.update(gameRef, {
            [`players.${user.uid}`]: {
                displayName: user.displayName,
                photoURL: user.photoURL,
                bio: user.bio || '',
            },
            playerIds: newPlayerIds,
            status: 'in-progress',
            gameState: getInitialDuelGameState(newPlayerIds),
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
  // This is a simplified update. For nested objects, you might need to use dot notation
  // or merge options if you only want to update parts of the gameState.
  // For this game's logic, overwriting the whole gameState is often intended.
  await updateDoc(gameRef, { 
      status: newGameState.status, // Also update top-level status if present
      winner: newGameState.winner, // Also update winner if present
      gameState: newGameState 
  });
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

// --- Auto Matchmaking ---
export const findAndJoinGame = async (user: MockUser, gameType: GameType): Promise<string> => {
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
      const newPlayerIds = [...suitableGame.playerIds, user.uid];

      transaction.update(gameRef, {
        [`players.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
          bio: user.bio || '',
        },
        playerIds: newPlayerIds,
        status: 'in-progress',
        gameState: getInitialDuelGameState(newPlayerIds),
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
            bio: user.bio || '',
          },
        },
        playerIds: [user.uid],
        status: 'waiting',
        createdAt: serverTimestamp(),
        gameState: gameType === 'duel' ? getInitialDuelGameState([user.uid]) : {},
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

// --- Posts (Bulletin Board) ---

// Create a new post
export const createPost = async (author: MockUser, content: string): Promise<void> => {
  if (!content.trim()) {
    throw new Error("Post content cannot be empty.");
  }
  const postsCollection = collection(db, 'posts');
  await addDoc(postsCollection, {
    author: {
      uid: author.uid,
      displayName: author.displayName,
      photoURL: author.photoURL,
    },
    content,
    createdAt: serverTimestamp(),
    likes: [],
    likeCount: 0,
  });
};

// Listen for all posts
export const subscribeToPosts = (callback: (posts: Post[]) => void) => {
  const postsCollection = collection(db, 'posts');
  const q = query(postsCollection, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(q, (querySnapshot) => {
    const posts: Post[] = [];
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() } as Post);
    });
    callback(posts);
  });
};

// Listen for posts by a specific user
export const subscribeToUserPosts = (userId: string, callback: (posts: Post[]) => void) => {
    const postsCollection = collection(db, 'posts');
    const q = query(
        postsCollection, 
        where('author.uid', '==', userId), 
        orderBy('createdAt', 'desc'), 
        limit(50)
    );

    return onSnapshot(q, (querySnapshot) => {
        const posts: Post[] = [];
        querySnapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() } as Post);
        });
        callback(posts);
    });
};

// Like/Unlike a post
export const togglePostLike = async (postId: string, userId: string): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    await runTransaction(db, async (transaction) => {
        const postSnap = await transaction.get(postRef);
        if (!postSnap.exists()) {
            throw new Error("Post not found");
        }

        const postData = postSnap.data();
        const likes = (postData.likes || []) as string[];
        let newLikes;

        if (likes.includes(userId)) {
            // User has liked, so unlike
            newLikes = likes.filter(uid => uid !== userId);
        } else {
            // User has not liked, so like
            newLikes = [...likes, userId];
        }

        transaction.update(postRef, {
            likes: newLikes,
            likeCount: newLikes.length
        });
    });
};

// Delete a post
export const deletePost = async (postId: string): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    await deleteDoc(postRef);
};


// --- Card Management ---

const CARD_CACHE_KEY = 'cardverse-card-cache';
const CACHE_EXPIRATION_MS = 1000 * 60 * 60; // 1 hour cache

/**
 * Fetches all card definitions from Firestore, with caching.
 * @param forceRefresh If true, bypasses the cache and fetches fresh data from Firestore.
 * @returns A promise that resolves to an array of CardData.
 */
export const getCards = async (forceRefresh: boolean = false): Promise<CardData[]> => {
    // 1. Check localStorage for cached data if not forcing a refresh
    if (!forceRefresh) {
        try {
            const cachedItem = localStorage.getItem(CARD_CACHE_KEY);
            if (cachedItem) {
                const { timestamp, data } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
                    console.log(`Returning all cached cards`);
                    return data as CardData[];
                } else {
                    console.log("Card cache expired.");
                }
            }
        } catch (e) {
            console.error("Error reading from card cache", e);
        }
    }
    
    // 2. If no valid cache or forcing refresh, fetch from Firestore
    console.log("Fetching all cards from Firestore...");
    const cardsCollection = collection(db, 'cards');
    const querySnapshot = await getDocs(cardsCollection);
    const cards: CardData[] = [];
    querySnapshot.forEach((doc) => {
        cards.push({ id: doc.id, ...doc.data() } as CardData);
    });

    // 3. Cache the new data in localStorage
    try {
        const cacheItem = { timestamp: Date.now(), data: cards };
        localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cacheItem));
        console.log(`Cached ${cards.length} cards.`);
    } catch (e) {
        console.error("Error writing to card cache", e);
    }

    if (cards.length === 0) {
        console.warn(`No cards found in Firestore at all. The game may not work correctly.`);
    }

    return cards;
};


/**
 * Uploads a card image and adds the card data to Firestore.
 * @param cardData The card data to add, without id and imageUrl.
 * @param imageFile The image file to upload for the card.
 */
export const addCard = async (
  cardData: Omit<CardData, 'id' | 'imageUrl'>,
  imageFile: File
): Promise<void> => {
  // 1. Upload image to Firebase Storage
  const filePath = `cards/${Date.now()}_${imageFile.name}`;
  const imageRef = ref(storage, filePath);
  const uploadResult = await uploadBytes(imageRef, imageFile);
  const imageUrl = await getDownloadURL(uploadResult.ref);

  // 2. Add card data to Firestore
  const cardsCollection = collection(db, 'cards');
  await addDoc(cardsCollection, {
    ...cardData,
    imageUrl: imageUrl, // Add the retrieved image URL
    createdAt: serverTimestamp(),
  });

  // 3. Force refresh the cache after adding a new card
  await getCards(true);
};


/**
 * Deletes a card from Firestore and its image from Storage.
 * @param card The card object to delete.
 */
export const deleteCard = async (card: CardData): Promise<void> => {
    // 1. Delete the document from Firestore
    const cardRef = doc(db, 'cards', card.id);
    await deleteDoc(cardRef);

    // 2. Delete the image from Firebase Storage
    // It's important to handle cases where imageUrl might not be a Firebase Storage URL
    if (card.imageUrl && card.imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const imageRef = ref(storage, card.imageUrl);
            await deleteObject(imageRef);
        } catch (error) {
            // If the image doesn't exist, Storage throws an error. We can often ignore this.
            console.warn(`Could not delete image ${card.imageUrl} from Storage. It might not exist.`, error);
        }
    }

    // 3. Force refresh the cache
    await getCards(true);
};

    