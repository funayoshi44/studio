





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
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { Game, GameType, MockUser, Post, CardData } from './types';
import { createPokerDeck, evaluatePokerHand } from './game-logic/poker';


const TOTAL_ROUNDS = 13;

const getInitialDuelGameState = async (playerIds: string[] = []) => {
    // Fetch all cards from the database
    const allCards = await getCards();

    // Create a unique deck of 13 cards, one for each number from 1 to 13
    const cardMap = new Map<number, CardData>();
    for (const card of allCards) {
        if (card.number >= 1 && card.number <= 13 && !cardMap.has(card.number)) {
            cardMap.set(card.number, card);
        }
    }
    const baseDeck = Array.from({ length: 13 }, (_, i) => i + 1).map(num => {
        return cardMap.get(num) || {
            id: `fallback-${num}`, name: `Card ${num}`, number: num, value: num, suit: '?',
            imageUrl: `https://picsum.photos/seed/card-fallback-${num}/200/300`,
            gameType: 'common', artist: 'System', rarity: 'common', tags: []
        };
    });

    const gameState: any = {
        currentRound: 1,
        playerHands: {},
        scores: {},
        kyuso: {},
        only: {},
        moves: {}, // Stores the played card object
        lastMoveBy: null,
        history: {},
        roundWinner: null,
        roundResultText: '',
        roundResultDetail: '',
    };

    playerIds.forEach(uid => {
        // Each player gets a shuffled full deck of CardData objects
        gameState.playerHands[uid] = [...baseDeck].sort(() => Math.random() - 0.5);
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
        moves: {}, // { initial: { uid: move }, final: { uid: move } }
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

const getInitialPokerGameState = async (playerIds: string[] = []) => {
    const deck = await createPokerDeck();
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
    switch (gameType) {
        case 'duel':
            return getInitialDuelGameState(playerIds);
        case 'janken':
            return getInitialJankenGameState(playerIds);
        case 'poker':
            return getInitialPokerGameState(playerIds);
        default:
            return getInitialDuelGameState(playerIds);
    }
}


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
    maxPlayers: gameType === 'poker' ? 4 : 2,
    gameState: {}, // Initialize with an empty object
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
        const maxPlayers = gameData.maxPlayers || 2;
        
        // Prevent joining if game is full, or already started, or user is already in
        if (gameData.playerIds.length >= maxPlayers || gameData.status !== 'waiting' || gameData.playerIds.includes(user.uid)) {
            return;
        }
        
        const newPlayerIds = [...gameData.playerIds, user.uid];

        // For Duel and Janken, start the game when lobby is full
        const isGameStarting = (gameData.gameType === 'duel' || gameData.gameType === 'janken') && newPlayerIds.length === maxPlayers;
        
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
            updates.gameState = await getInitialStateForGame(gameData.gameType, newPlayerIds);
        }

        transaction.update(gameRef, updates);
    });
};

// Manually start a game (for Poker)
export const startGame = async (gameId: string) => {
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

        transaction.update(gameRef, {
            status: 'in-progress',
            gameState: initialGameState
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
  
  const updatePayload: { [key: string]: any } = {};

  if (newGameState !== undefined) {
    updatePayload.gameState = newGameState;
  }
  
  // Conditionally add status and winner to the payload if they exist in newGameState
  if (newGameState.status !== undefined) {
    updatePayload.status = newGameState.status;
  }
  if (newGameState.winner !== undefined) {
    updatePayload.winner = newGameState.winner;
  }

  if (Object.keys(updatePayload).length > 0) {
    await updateDoc(gameRef, updatePayload);
  }
};


// Submit a move
export const submitMove = async (gameId: string, userId: string, move: any, phase?: 'initial' | 'final') => {
    const gameRef = doc(db, 'games', gameId);
    await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found!");

        const gameData = gameDoc.data() as Game;
        let newGameState = { ...gameData.gameState };

        if (gameData.gameType === 'janken' && phase) {
            newGameState.moves[userId][phase] = move;
        } else if (gameData.gameType === 'poker') {
            if (move.action === 'exchange') {
                const { indices } = move;
                let playerHand = [...newGameState.playerHands[userId]];
                let deck = [...newGameState.deck];
                indices.forEach((index: number) => {
                    if (deck.length > 0) {
                        playerHand[index] = deck.pop()!;
                    }
                });
                newGameState.playerHands[userId] = playerHand;
                newGameState.deck = deck;
                newGameState.exchangeCounts[userId]++;
            }
            
            // Advance turn or go to showdown
            const currentIndex = newGameState.turnOrder.indexOf(userId);
            const nextIndex = (currentIndex + 1) % gameData.playerIds.length;
            newGameState.currentTurnIndex = nextIndex;

            // If it's back to the first player, or if showdown is triggered, evaluate.
            if (nextIndex === 0 || move.action === 'showdown' || newGameState.exchangeCounts[userId] >= 2) {
                newGameState.phase = 'showdown';
                // Evaluate all hands
                gameData.playerIds.forEach(pid => {
                    newGameState.playerRanks[pid] = evaluatePokerHand(newGameState.playerHands[pid]);
                });

                // Find winner(s)
                let highestRank = { name: '', value: 0 };
                let winners: string[] = [];
                gameData.playerIds.forEach(pid => {
                    const rank = newGameState.playerRanks[pid];
                    if (rank.value > highestRank.value) {
                        highestRank = rank;
                        winners = [pid];
                    } else if (rank.value === highestRank.value) {
                        winners.push(pid);
                    }
                });
                newGameState.winners = winners;
                newGameState.resultText = winners.length > 1 
                    ? `Draw between ${winners.map(w => gameData.players[w]?.displayName).join(', ')}!`
                    : `${gameData.players[winners[0]]?.displayName} wins with a ${highestRank.name}!`;
                newGameState.phase = 'finished';
            }

        } else { // Duel
            newGameState.moves[userId] = move;
            newGameState.lastMoveBy = userId;
        }
        
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
      const isGameStarting = (gameType === 'duel' || gameType === 'janken') && newPlayerIds.length === (suitableGame.maxPlayers || maxPlayers);
      
      const updates: any = {
        [`players.${user.uid}`]: { displayName: user.displayName, photoURL: user.photoURL, bio: user.bio || '' },
        playerIds: newPlayerIds
      };

      if (isGameStarting) {
        updates.status = 'in-progress';
        updates.gameState = await getInitialStateForGame(gameType, newPlayerIds);
      }
      
      transaction.update(gameRef, updates);
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
        gameState: {},
        maxPlayers: maxPlayers,
      });
      return newGameRef.id;
    }
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
            if (gameData.status === 'finished') return;

            const remainingPlayers = gameData.playerIds.filter(p => p !== leavingPlayerId);

            if (remainingPlayers.length < 2 && gameData.status === 'in-progress') {
                // If only one player is left, they are the winner.
                transaction.update(gameRef, {
                    status: 'finished',
                    winner: remainingPlayers[0] || null,
                });
            } else if (remainingPlayers.length > 0) {
                 // The game continues with the remaining players
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
                // No players left, just mark as finished
                transaction.update(gameRef, { status: 'finished', winner: null });
            }
        });
    } catch (error) {
        console.error("Failed to leave game:", error);
    }
};

// Get a single user's profile
export const getUserProfile = async (userId: string): Promise<MockUser | null> => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data() as MockUser;
    }
    return null;
}

// --- Posts (Bulletin Board) ---

// Create a new post or reply
export const createPost = async (author: MockUser, content: string, parentId: string | null = null): Promise<void> => {
  if (!content.trim()) {
    throw new Error("Post content cannot be empty.");
  }
  const postsCollection = collection(db, 'posts');

  await runTransaction(db, async (transaction) => {
    // Add the new post/reply
    const newPostRef = doc(postsCollection);
    transaction.set(newPostRef, {
      author: {
        uid: author.uid,
        displayName: author.displayName,
        photoURL: author.photoURL,
      },
      content,
      parentId,
      createdAt: serverTimestamp(),
      likes: [],
      likeCount: 0,
      replyCount: 0,
    });

    // If it's a reply, increment the parent's replyCount
    if (parentId) {
      const parentRef = doc(db, 'posts', parentId);
      const parentSnap = await transaction.get(parentRef);
      if (parentSnap.exists()) {
        const parentData = parentSnap.data();
        const newReplyCount = (parentData.replyCount || 0) + 1;
        transaction.update(parentRef, { replyCount: newReplyCount });
      }
    }
  });
};


// Listen for all top-level posts
export const subscribeToPosts = (callback: (posts: Post[]) => void) => {
  const postsCollection = collection(db, 'posts');
  const q = query(
    postsCollection, 
    where('parentId', '==', null), // Only fetch top-level posts
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

// Listen for replies to a specific post
export const subscribeToReplies = (postId: string, callback: (posts: Post[]) => void) => {
  const postsCollection = collection(db, 'posts');
  const q = query(
    postsCollection,
    where('parentId', '==', postId),
    orderBy('createdAt', 'asc') // Show replies in chronological order
  );
  return onSnapshot(q, (snapshot) => {
    const replies: Post[] = [];
    snapshot.forEach((doc) => {
      replies.push({ id: doc.id, ...doc.data() } as Post);
    });
    callback(replies);
  });
};


// Listen for posts by a specific user (both top-level and replies)
export const subscribeToUserPosts = (userId: string, callback: (posts: Post[]) => void) => {
    const postsCollection = collection(db, 'posts');
    const q = query(
        postsCollection, 
        where('author.uid', '==', userId), 
        orderBy('createdAt', 'desc'),
        limit(50)
    );

    return onSnapshot(q, (snapshot) => {
        const posts: Post[] = [];
        snapshot.forEach((doc) => {
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

// Delete a post and all its replies
export const deletePost = async (postId: string): Promise<void> => {
    const postRef = doc(db, 'posts', postId);
    
    // First, find all replies to this post
    const repliesQuery = query(collection(db, 'posts'), where('parentId', '==', postId));
    const repliesSnapshot = await getDocs(repliesQuery);

    const batch = writeBatch(db);

    // Delete all replies
    repliesSnapshot.forEach(replyDoc => {
        batch.delete(replyDoc.ref);
    });

    // Delete the parent post itself
    batch.delete(postRef);

    // Commit the batch
    await batch.commit();
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
