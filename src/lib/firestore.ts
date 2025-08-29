

import { db, storage } from './firebase';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
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
  writeBatch,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Game, GameType, MockUser, Post, CardData, ChatRoom, ChatMessage, Announcement, JankenAction, CardSeries } from './types';
import { createPokerDeck, evaluatePokerHand } from './game-logic/poker';


const CARDS_COLLECTION = process.env.NEXT_PUBLIC_CARDS_COLLECTION_NAME || 'cards';
const CARD_CACHE_KEY = `cardverse-${CARDS_COLLECTION}-cache`;
const SERIES_CACHE_KEY = `cardverse-series-cache`;
const CACHE_EXPIRATION_MS = 1000 * 60 * 60; // 1 hour cache


// --- Point System ---
export const awardPoints = async (userId: string, amount: number) => {
    if (!db || !userId) return;
    // This function should ideally be a server-side Cloud Function
    // to prevent client-side manipulation. For now, it's here.
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        points: increment(amount)
    });
};


const createDefaultDeck = (count = 13): CardData[] => {
    // This function will need to be updated to generate cards matching the new `CardData` structure.
    // For now, it will generate a simplified version for compatibility.
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
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            // --- Compatibility fields ---
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
    // If not enough registered cards, supplement with default cards
    if (deck.length < 13) {
        const needed = 13 - deck.length;
        const defaultCards = createDefaultDeck(13); // Create a full default deck
        // Get unique default cards that don't clash with registered ones by number
        const uniqueDefaults = defaultCards.filter(dc => !deck.some(rc => rc.number === dc.number));
        deck.push(...uniqueDefaults.slice(0, needed));
    }
    
    // Shuffle and pick 13
    const shuffled = deck.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 13);
};


const getInitialDuelGameState = (allCards: CardData[], playerIds: string[]) => {
    const hands: { [uid: string]: any[] } = {};
    const scores: { [uid: string]: number } = {};
    const kyuso: { [uid: string]: number } = {};
    const only: { [uid: string]: number } = {};
    const moves: { [uid: string]: null } = {};

    playerIds.forEach(uid => {
        hands[uid] = createRandomDeck(allCards).map(c => ({ id: c.id, suit: c.suit, rank: c.rank, number: c.number }));
        scores[uid] = 0;
        kyuso[uid] = 0;
        only[uid] = 0;
        moves[uid] = null;
    });

    return {
        main: {
            currentRound: 1,
            lastMoveBy: null,
            roundWinner: null,
            roundResultText: '',
            roundResultDetail: '',
        },
        hands,
        scores,
        kyuso,
        only,
        moves,
        lastHistory: {} // Initialize as an empty object instead of null
    };
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


const getInitialPokerGameState = (allCards: CardData[], playerIds: string[] = []) => {
    const deck = createPokerDeck(allCards);
    const gameState: any = {
        phase: 'dealing', // dealing -> exchanging -> showdown -> finished
        deck: [],
        playerHands: {},
        selectedCards: {},
        exchangeCounts: {},
        playerRanks: {},
        turnOrder: playerIds.sort(() => Math.random() - 0.5), // Randomize turn order
        currentTurnIndex: 0,
        winners: null,
        resultText: '',
    };

    playerIds.forEach(uid => {
        gameState.playerHands[uid] = deck.splice(0, 5);
        gameState.exchangeCounts[uid] = 0;
        gameState.selectedCards[uid] = [];
        gameState.playerRanks[uid] = null;
    });

    gameState.deck = deck;
    gameState.phase = 'exchanging';

    return gameState;
};


const getInitialStateForGame = async (gameType: GameType, playerIds: string[]) => {
    const allCards = await getCards(true); // Always get fresh cards when starting a game
    switch (gameType) {
        case 'duel':
            return getInitialDuelGameState(allCards, playerIds);
        case 'janken':
            return getInitialJankenGameState(playerIds);
        case 'poker':
            return getInitialPokerGameState(allCards, playerIds);
        default:
            return {};
    }
}


// Upload a profile image and get the URL
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage is not initialized.");
    const storageRef = ref(storage, `profileImages/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

// Create a new game
export const createGame = async (user: MockUser, gameType: GameType): Promise<string> => {
  if (!db) throw new Error("Firestore is not initialized.");
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
    maxPlayers: gameType === 'poker' ? 4 : 2,
  });
  
  // Awarding points here can be risky if transaction fails. Best handled server-side.
  // await awardPoints(user.uid, 1);
  return docRef.id;
};

// Join a game
export const joinGame = async (gameId: string, user: MockUser): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized.");
    const gameRef = doc(db, 'games', gameId);

    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);

        if (!gameSnap.exists()) {
            throw new Error('Game not found');
        }

        const gameData = gameSnap.data() as Game;
        const maxPlayers = gameData.maxPlayers || 2;
        
        if (gameData.playerIds.length >= maxPlayers || gameData.status !== 'waiting' || gameData.playerIds.includes(user.uid)) {
            return;
        }
        
        const newPlayerIds = [...gameData.playerIds, user.uid];
        const isGameStarting = newPlayerIds.length === maxPlayers;
        
        const updates: any = {
             [`players.${user.uid}`]: {
                displayName: user.displayName,
                photoURL: user.photoURL,
                bio: user.bio || '',
            },
            playerIds: newPlayerIds,
        };

        if (isGameStarting) {
            updates.status = 'in-progress';
        }

        transaction.update(gameRef, updates);
        
        if (isGameStarting) {
            const initialGameState = await getInitialStateForGame(gameData.gameType, newPlayerIds);
            const batch = writeBatch(db);
            
            for (const key in initialGameState) {
                if (key === 'hands' || key === 'moves') { // These are sub-collections
                    for (const playerId in initialGameState[key]) {
                        const playerSubDocRef = doc(db, 'games', gameId, key, playerId);
                        if(key === 'hands') {
                             batch.set(playerSubDocRef, { cards: initialGameState[key][playerId] });
                        } else {
                             batch.set(playerSubDocRef, { card: initialGameState[key][playerId] });
                        }
                    }
                } else { // These are documents in the 'state' subcollection
                    const stateSubDocRef = doc(db, 'games', gameId, 'state', key);
                    batch.set(stateSubDocRef, initialGameState[key]);
                }
            }
            await batch.commit();
        }
    });
};

// Manually start a game (for Poker)
export const startGame = async (gameId: string) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const gameRef = doc(db, 'games', gameId);
    await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) {
            throw new Error("Game not found");
        }
        const gameData = gameSnap.data() as Game;
        if (gameData.status !== 'waiting' || gameData.playerIds.length < 2) {
            throw new Error("Game cannot be started.");
        }

        const initialGameState = await getInitialStateForGame(gameData.gameType, gameData.playerIds);
        
        transaction.update(gameRef, { status: 'in-progress' });
        
        const batch = writeBatch(db);
        for (const key in initialGameState) {
            if (key === 'hands' || key === 'moves') { // these are collections, not docs
                for (const playerId in initialGameState[key]) {
                    const playerSubDocRef = doc(db, 'games', gameId, key, playerId);
                    if (key === 'hands') {
                        batch.set(playerSubDocRef, { cards: initialGameState[key][playerId] });
                    } else {
                        batch.set(playerSubDocRef, { card: initialGameState[key][playerId] });
                    }
                }
            } else {
                 const stateSubDocRef = doc(db, 'games', gameId, 'state', key);
                 batch.set(stateSubDocRef, initialGameState[key]);
            }
        }
        await batch.commit();
    });
};


// Listen for game updates (deprecated for sharded model)
export const subscribeToGame = (gameId: string, callback: (game: Game | null) => void) => {
  if (!db) return () => {};
  const gameRef = doc(db, 'games', gameId);
  return onSnapshot(gameRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Game);
    } else {
      callback(null);
    }
  });
};

// Update a single document
export const updateGameState = async (gameId: string, updates: any): Promise<void> => {
  if (!db) throw new Error("Firestore is not initialized.");
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, { gameState: updates });
};

// Update multiple sharded state documents
export const updateShardedGameState = async (gameId: string, payload: any) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const batch = writeBatch(db);
    
    for (const key in payload) {
        if (key === 'hands' || key === 'moves') {
             for (const playerId in payload[key]) {
                const subDocRef = doc(db, 'games', gameId, key, playerId);
                if (payload[key][playerId] === null) {
                    batch.set(subDocRef, { card: null });
                } else if (Array.isArray(payload[key][playerId])) {
                    batch.set(subDocRef, { cards: payload[key][playerId] });
                } else {
                    batch.set(subDocRef, { card: payload[key][playerId] });
                }
            }
        } else {
             const stateSubDocRef = doc(db, 'games', gameId, 'state', key);
             batch.set(stateSubDocRef, payload[key], { merge: true });
        }
    }
    await batch.commit();
}


// Submit a move to its own document
export const submitMove = async (gameId: string, userId: string, move: any) => {
    if (!db) throw new Error("Firestore is not initialized.");
    const moveDocRef = doc(db, 'games', gameId, 'moves', userId);
    await setDoc(moveDocRef, { card: move });
    
    const mainStateRef = doc(db, 'games', gameId, 'state', 'main');
    await updateDoc(mainStateRef, { lastMoveBy: userId });
};



// Find available games
export const findAvailableGames = async (): Promise<Game[]> => {
  if (!db) return [];
  const gamesCollection = collection(db, 'games');
  const q = query(
    gamesCollection,
    where('status', '==', 'waiting'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const querySnapshot = await getDocs(q);
  const games: Game[] = [];
  querySnapshot.forEach((doc) => {
    games.push({ id: doc.id, ...doc.data() } as Game);
  });
  return games;
};

// Subscribe to available games
export const subscribeToAvailableGames = (callback: (games: Game[]) => void): (() => void) => {
    if (!db) return () => {};
    const gamesCollection = collection(db, 'games');
    const q = query(
        gamesCollection,
        where('status', '==', 'waiting'),
        orderBy('createdAt', 'desc'),
        limit(20)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const games: Game[] = [];
        querySnapshot.forEach((doc) => {
            games.push({ id: doc.id, ...doc.data() } as Game);
        });
        callback(games);
    });

    return unsubscribe;
};


// --- Auto Matchmaking ---
export const findAndJoinGame = async (user: MockUser, gameType: GameType): Promise<string> => {
  if (!db) throw new Error("Firestore is not initialized.");
  const gamesRef = collection(db, 'games');
  const maxPlayers = gameType === 'poker' ? 4 : 2;
  
  return runTransaction(db, async (transaction) => {
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
        if (!game.playerIds.includes(user.uid) && game.playerIds.length < maxPlayers) {
            suitableGame = game;
            suitableGameId = doc.id;
            break;
        }
    }

    if (suitableGame && suitableGameId) {
      const gameRef = doc(db, 'games', suitableGameId);
      const newPlayerIds = [...suitableGame.playerIds, user.uid];
      const isGameStarting = newPlayerIds.length === (suitableGame.maxPlayers || maxPlayers);
      
      const updates: any = {
        [`players.${user.uid}`]: { displayName: user.displayName, photoURL: user.photoURL, bio: user.bio || '' },
        playerIds: newPlayerIds
      };

      if (isGameStarting) {
        updates.status = 'in-progress';
      }
      
      transaction.update(gameRef, updates);
      
      if (isGameStarting) {
          const initialGameState = await getInitialStateForGame(gameType, newPlayerIds);
          const batch = writeBatch(db);
            for (const key in initialGameState) {
                if (key === 'hands' || key === 'moves') { // These are sub-collections
                    for(const playerId in initialGameState[key]) {
                        const subDocRef = doc(db, 'games', suitableGameId, key, playerId);
                        if (key === 'hands') {
                             batch.set(subDocRef, { cards: initialGameState[key][playerId] });
                        } else {
                             batch.set(subDocRef, { card: initialGameState[key][playerId] });
                        }
                    }
                } else {
                    const subDocRef = doc(db, 'games', suitableGameId, 'state', key);
                    batch.set(subDocRef, initialGameState[key]);
                }
            }
          await batch.commit();
      }
      
      return suitableGameId;
    } else {
      // No suitable waiting games found, create a new one
      const newGameRef = doc(collection(db, "games"));
      
      transaction.set(newGameRef, {
        gameType,
        players: { [user.uid]: { displayName: user.displayName, photoURL: user.photoURL, bio: user.bio || '' } },
        playerIds: [user.uid],
        status: 'waiting',
        createdAt: serverTimestamp(),
        maxPlayers: maxPlayers,
      });
      return newGameRef.id;
    }
  });
};

// Forfeit a game
export const leaveGame = async (gameId: string, leavingPlayerId: string): Promise<void> => {
    if (!db) return;
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
            const gameSnap = await transaction.get(gameRef);
            if (!gameSnap.exists()) {
                console.log("Game not found, can't leave.");
                return;
            }

            const gameData = gameSnap.data() as Game;
            if (gameData.status === 'finished') return;

            const remainingPlayers = gameData.playerIds.filter(p => p !== leavingPlayerId);

            if (remainingPlayers.length < 2 && gameData.status === 'in-progress') {
                // If only one player is left, they are the winner.
                const winnerId = remainingPlayers[0] || null;
                // awardPoints is now a server-side responsibility.
                transaction.update(gameRef, {
                    status: 'finished',
                    winner: winnerId,
                });
            } else if (remainingPlayers.length > 0) {
                 const newPlayerIds = remainingPlayers;
                 const newPlayersObject: { [uid: string]: any } = {};
                 newPlayerIds.forEach(pid => {
                     newPlayersObject[pid] = gameData.players[pid];
                 });
                 transaction.update(gameRef, {
                     playerIds: newPlayerIds,
                     players: newPlayersObject
                 })
            } else {
                // No players left, we can delete the game.
                transaction.delete(gameRef);
            }
        });
    } catch (error) {
        console.error("Failed to leave game:", error);
    }
};

// Get a single user's profile
export const getUserProfile = async (userId: string): Promise<MockUser | null> => {
    if (!db) return null;
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data() as MockUser;
    }
    return null;
}

// Update a user's myCards
export const updateMyCards = async (userId: string, cardIds: string[]): Promise<void> => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        myCards: cardIds,
    });
};

// --- Janken Actions ---
export const setJankenAction = async (
    userId: string, 
    type: 'rock' | 'paper' | 'scissors',
    data: { title: string, comment: string },
    imageFile: File | null
): Promise<void> => {
      if (!db || !storage) throw new Error("Firebase is not initialized.");
    const docId = `${userId}_${type}`;
    const actionRef = doc(db, 'jankenActions', docId);

    const actionData: Partial<JankenAction> = {
        userId,
        type,
        title: data.title,
        comment: data.comment,
        updatedAt: serverTimestamp(),
    };

    if (imageFile) {
        const storageRef = ref(storage, `jankenActions/${userId}/${type}_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        actionData.imageUrl = await getDownloadURL(snapshot.ref);
    }

    await setDoc(actionRef, actionData, { merge: true });
};

export const getJankenActions = async (userId: string): Promise<{ [key in 'rock' | 'paper' | 'scissors']?: JankenAction }> => {
    if (!db) return {};
    const actions: { [key in 'rock' | 'paper' | 'scissors']?: JankenAction } = {};
    const q = query(collection(db, 'jankenActions'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        const data = doc.data() as JankenAction;
        actions[data.type] = { id: doc.id, ...data };
    });
    return actions;
};


// --- Posts (Bulletin Board) ---

export const createPost = async (author: MockUser, content: string): Promise<void> => {
    if (!db) return;
    if (!content.trim()) {
        throw new Error("Post content cannot be empty.");
    }
    const postData = {
        author: {
            uid: author.uid,
            displayName: author.displayName,
            photoURL: author.photoURL,
        },
        content,
        createdAt: serverTimestamp(),
        likes: [],
        likeCount: 0,
    };
    await addDoc(collection(db, 'posts'), postData);
};


export const subscribeToPosts = (callback: (posts: Post[]) => void) => {
  if (!db) return () => {};
  const postsCollection = collection(db, 'posts');
  const q = query(
    postsCollection, 
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

export const subscribeToUserPosts = (userId: string, callback: (posts: Post[]) => void) => {
    if (!db) return () => {};
    const postsCollection = collection(db, 'posts');
    const q = query(
        postsCollection, 
        where('author.uid', '==', userId),
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const posts: Post[] = [];
        snapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() } as Post);
        });
        const sortedPosts = posts.sort((a, b) => {
            const timeA = a.createdAt?.toMillis() || 0;
            const timeB = b.createdAt?.toMillis() || 0;
            return timeB - timeA;
        });
        callback(sortedPosts);
    });
};


// Like/Unlike a post
export const togglePostLike = async (postId: string, userId: string): Promise<void> => {
    if (!db) return;
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
            newLikes = likes.filter(uid => uid !== userId);
        } else {
            newLikes = [...likes, userId];
        }

        transaction.update(postRef, {
            likes: newLikes,
            likeCount: newLikes.length
        });
    });
};

export const deletePost = async (postId: string): Promise<void> => {
    if (!db) return;
    const postRef = doc(db, 'posts', postId);
    await deleteDoc(postRef);
};



// --- Card Management ---

const deriveCompatibilityFields = (card: Omit<CardData, 'id'>, id: string): CardData => {
    const rankNumber = typeof card.rank === 'number' ? card.rank : (card.rank === 'Joker' ? 0 : -1);
    return {
        ...card,
        id: id,
        number: rankNumber,
        value: rankNumber, // Assuming value is the same as number for now
        name: card.title,
        artist: card.authorName,
        imageUrl: card.frontImageUrl,
        rarity: 'common', // Default rarity, could be a field in the new structure later
        tags: card.hashtags,
        gameType: 'common', // Default gameType, can be derived or set based on series or tags later
    };
};

export const getCards = async (forceRefresh: boolean = false): Promise<CardData[]> => {
    if (!db) return [];
    if (!forceRefresh) {
        if (typeof window !== 'undefined') {
            try {
                const cachedItem = localStorage.getItem(CARD_CACHE_KEY);
                if (cachedItem) {
                    const { timestamp, data } = JSON.parse(cachedItem);
                    if (Date.now() - timestamp < CACHE_EXPIRATION_MS && data && data.length > 0) {
                        return data as CardData[];
                    }
                }
            } catch (e) {
                console.error("Error reading from card cache", e);
            }
        }
    }
    
    const cardsCollection = collection(db, CARDS_COLLECTION);
    const querySnapshot = await getDocs(cardsCollection);
    const cards: CardData[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<CardData, 'id'>;
        cards.push(deriveCompatibilityFields(data, doc.id));
    });

    if (typeof window !== 'undefined') {
        try {
            const cacheItem = { timestamp: Date.now(), data: cards };
            localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cacheItem));
        } catch (e) {
            console.error("Error writing to card cache", e);
        }
    }

    return cards;
};

export const getCardById = async (id: string): Promise<CardData | null> => {
    if (!db) return null;
    const cardRef = doc(db, CARDS_COLLECTION, id);
    const docSnap = await getDoc(cardRef);

    if (docSnap.exists()) {
        return deriveCompatibilityFields(docSnap.data() as Omit<CardData, 'id'>, docSnap.id);
    }

    return null;
}


export const addCard = async (
  cardData: Omit<CardData, 'id' | 'frontImageUrl' | 'backImageUrl' | 'createdAt' | 'updatedAt' | 'authorId'>,
  imageFile: File,
  author: MockUser,
  backImageFile?: File | null
): Promise<void> => {
  if (!db || !storage) throw new Error("Firebase is not initialized.");
  const filePath = `${CARDS_COLLECTION}/${Date.now()}_${imageFile.name}`;
  const imageRef = ref(storage, filePath);
  const uploadResult = await uploadBytes(imageRef, imageFile);
  const imageUrl = await getDownloadURL(uploadResult.ref);
  
  const cardToSave: any = {
    ...cardData,
    frontImageUrl: imageUrl,
    authorId: author.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (backImageFile) {
      const backFilePath = `${CARDS_COLLECTION}/backs/${Date.now()}_${backImageFile.name}`;
      const backImageRef = ref(storage, backFilePath);
      const backUploadResult = await uploadBytes(backImageRef, backImageFile);
      cardToSave.backImageUrl = await getDownloadURL(backUploadResult.ref);
  }

  const cardsCollection = collection(db, CARDS_COLLECTION);
  await addDoc(cardsCollection, cardToSave);

  await getCards(true);
};


export const deleteCard = async (card: CardData): Promise<void> => {
    if (!db || !storage) return;
    const cardRef = doc(db, CARDS_COLLECTION, card.id);
    await deleteDoc(cardRef);

    if (card.frontImageUrl && card.frontImageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const imageRef = ref(storage, card.frontImageUrl);
            await deleteObject(imageRef);
        } catch (error) {
            console.warn(`Could not delete image ${card.frontImageUrl} from Storage. It might not exist.`, error);
        }
    }
     if (card.backImageUrl && card.backImageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const imageRef = ref(storage, card.backImageUrl);
            await deleteObject(imageRef);
        } catch (error) {
            console.warn(`Could not delete image ${card.backImageUrl} from Storage. It might not exist.`, error);
        }
    }


    await getCards(true);
};

// --- Series Management ---

export const getSeries = async (forceRefresh: boolean = false): Promise<CardSeries[]> => {
    if (!db) return [];
    if (!forceRefresh) {
        if (typeof window !== 'undefined') {
            try {
                const cachedItem = localStorage.getItem(SERIES_CACHE_KEY);
                if (cachedItem) {
                    const { timestamp, data } = JSON.parse(cachedItem);
                    if (Date.now() - timestamp < CACHE_EXPIRATION_MS && data && data.length > 0) {
                        // When retrieving from cache, Firestore Timestamps can be serialized. We need to convert them back.
                        const parsedData = data.map((item: any) => ({
                            ...item,
                            createdAt: item.createdAt?.seconds 
                                ? new Timestamp(item.createdAt.seconds, item.createdAt.nanoseconds) 
                                : Timestamp.fromDate(new Date(item.createdAt))
                        }));
                        return parsedData as CardSeries[];
                    }
                }
            } catch (e) {
                console.error("Error reading from series cache", e);
            }
        }
    }
    const seriesCollection = collection(db, 'series');
    const q = query(seriesCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const series: CardSeries[] = [];
    querySnapshot.forEach((doc) => {
        series.push({ id: doc.id, ...doc.data() } as CardSeries);
    });
    
    if (typeof window !== 'undefined') {
        try {
            const cacheItem = { timestamp: Date.now(), data: series };
            localStorage.setItem(SERIES_CACHE_KEY, JSON.stringify(cacheItem));
        } catch (e) {
            console.error("Error writing to series cache", e);
        }
    }
    return series;
}

export const addSeries = async (name: string): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized.");
    // Check if series with the same name already exists to prevent duplicates
    const seriesCollection = collection(db, 'series');
    const q = query(seriesCollection, where("name", "==", name));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        throw new Error(`Series with name "${name}" already exists.`);
    }

    const docRef = await addDoc(seriesCollection, {
        name,
        createdAt: serverTimestamp(),
    });
    return docRef.id;
}

export const deleteSeries = async (id: string): Promise<void> => {
    if (!db) return;
    // Note: This does not delete cards within the series.
    // That logic could be added here if needed (e.g., using a transaction or batch write).
    const seriesRef = doc(db, 'series', id);
    await deleteDoc(seriesRef);
}


// --- Game History ---
export const getUserGameHistory = async (userId: string): Promise<Game[]> => {
    if (!db) return [];
    const gamesCollection = collection(db, 'games');
    const q = query(
        gamesCollection,
        where('playerIds', 'array-contains', userId),
        where('status', '==', 'finished'),
        orderBy('createdAt', 'desc'),
        limit(50) 
    );

    const querySnapshot = await getDocs(q);
    const history: Game[] = [];
    querySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() } as Game);
    });
    return history;
};


// --- Announcements ---

export const createAnnouncement = async (author: MockUser, title: string, content: string): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized.");
    const announcementCollection = collection(db, 'announcements');
    const docRef = await addDoc(announcementCollection, {
        author: {
            uid: author.uid,
            displayName: author.displayName,
        },
        title,
        content,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return docRef.id;
};

export const updateAnnouncement = async (id: string, title: string, content: string): Promise<void> => {
    if (!db) return;
    const announcementRef = doc(db, 'announcements', id);
    await updateDoc(announcementRef, {
        title,
        content,
        updatedAt: serverTimestamp(),
    });
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
    if (!db) return;
    const announcementRef = doc(db, 'announcements', id);
    await deleteDoc(announcementRef);
};

export const subscribeToAnnouncements = (callback: (announcements: Announcement[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
        const announcements: Announcement[] = [];
        querySnapshot.forEach((doc) => {
            announcements.push({ id: doc.id, ...doc.data() } as Announcement);
        });
        callback(announcements);
    });
};

export const subscribeToLatestAnnouncements = (callback: (announcements: Announcement[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3));
    return onSnapshot(q, (querySnapshot) => {
        const announcements: Announcement[] = [];
        querySnapshot.forEach((doc) => {
            announcements.push({ id: doc.id, ...doc.data() } as Announcement);
        });
        callback(announcements);
    });
};


// --- Chat ---

// Create or get a chat room between two users
export const getOrCreateChatRoom = async (user1Id: string, user2Id: string): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized.");
    const members = [user1Id, user2Id].sort();
    const chatRoomId = members.join('-');
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    const chatRoomSnap = await getDoc(chatRoomRef);

    if (!chatRoomSnap.exists()) {
        const user1Profile = await getUserProfile(user1Id);
        const user2Profile = await getUserProfile(user2Id);

        if (!user1Profile || !user2Profile) {
            throw new Error("One or more user profiles not found.");
        }

        await setDoc(chatRoomRef, {
            participantIds: members,
            participantsInfo: {
                [user1Id]: { displayName: user1Profile.displayName, photoURL: user1Profile.photoURL },
                [user2Id]: { displayName: user2Profile.displayName, photoURL: user2Profile.photoURL }
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: '',
        });
    }

    return chatRoomId;
};

// Listen for a user's chat rooms
export const subscribeToChatRooms = (userId: string, callback: (rooms: ChatRoom[]) => void) => {
    if (!db) return () => {};
    const q = query(
        collection(db, 'chatRooms'),
        where('participantIds', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (querySnapshot) => {
        const rooms: ChatRoom[] = [];
        querySnapshot.forEach((doc) => {
            rooms.push({ id: doc.id, ...doc.data() } as ChatRoom);
        });
        callback(rooms);
    });
};

// Listen for messages in a specific chat room
export const subscribeToMessages = (chatRoomId: string, callback: (messages: ChatMessage[]) => void) => {
    if (!db) return () => {};
    const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

    return onSnapshot(q, (querySnapshot) => {
        const messages: ChatMessage[] = [];
        querySnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() } as ChatMessage);
        });
        callback(messages);
    });
};

// Send a message
export const sendMessage = async (chatRoomId: string, senderId: string, text: string, senderInfo: { displayName: string, photoURL: string }) => {
    if (!db) return;
    const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);

    const messageData = {
        senderId,
        text,
        createdAt: serverTimestamp(),
    };

    await addDoc(messagesRef, messageData);
    
    // Update the chat room's last message and timestamp
    await updateDoc(chatRoomRef, {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        // Make sure participantsInfo is up-to-date
        [`participantsInfo.${senderId}`]: senderInfo
    });
};

    
